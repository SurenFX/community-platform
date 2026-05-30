import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { AntiSpamService } from './anti-spam.service'
import { XpCalculatorService, XpEventType, SocialPlatform } from './xp-calculator.service'

export interface IncomingXpEvent {
  discordId:    string
  eventType:    XpEventType
  platform:     SocialPlatform
  externalRef?: string
  metadata?:    Record<string, unknown>
}

export interface XpResult {
  success:    boolean
  xpAwarded?: number
  newLevel?:  number
  leveledUp?: boolean
  reason?:    string
}

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name)

  constructor(
    private supabase:     SupabaseService,
    private redis:        RedisService,
    private antiSpam:     AntiSpamService,
    private xpCalc:       XpCalculatorService,
    private eventEmitter: EventEmitter2,
  ) {}

  async processXpEvent(event: IncomingXpEvent): Promise<XpResult> {
    try {
      // ── Distributed lock ──────────────────────────────────
      // Evita que múltiples instancias procesen el mismo evento
      // Solo aplica cuando hay externalRef (mensaje de Discord, Twitch, etc.)
      if (event.externalRef) {
        const lockKey = `lock:xp:${event.externalRef}`

        // SET NX EX — atómico, solo una máquina lo obtiene
        const acquired = await this.redis.setNX(lockKey, '1', 30)
        if (!acquired) {
          this.logger.debug(`Lock no obtenido — evento ya procesado: ${event.externalRef}`)
          return { success: false, reason: 'DUPLICATE' }
        }
      }

      // 1. Buscar perfil
      const { data: profile, error: profileError } = await this.supabase.db
        .from('profiles')
        .select('id, is_banned')
        .eq('discord_id', event.discordId)
        .single()

      if (profileError || !profile) {
        return { success: false, reason: 'USER_NOT_FOUND' }
      }
      if (profile.is_banned) {
        return { success: false, reason: 'USER_BANNED' }
      }

      // 2. Config XP
      const { data: config, error: configError } = await this.supabase.db
        .from('xp_config')
        .select('*')
        .eq('event_type', event.eventType)
        .eq('is_enabled', true)
        .single()

      if (configError || !config) {
        return { success: false, reason: 'EVENT_DISABLED' }
      }

      // 3. Anti-spam
      const spamCheck = await this.antiSpam.validate(
        profile.id, event.eventType, config, event.metadata,
      )
      if (!spamCheck.allowed) {
        this.logger.debug(`Blocked: user=${profile.id} reason=${spamCheck.reason}`)
        return { success: false, reason: spamCheck.reason }
      }

      // 4. Streak actual
      const { data: rep } = await this.supabase.db
        .from('user_reputation')
        .select('current_streak')
        .eq('user_id', profile.id)
        .single()

      // 5. Calcular XP
      const calculation = this.xpCalc.calculate({
        config,
        platform:     event.platform,
        qualityScore: spamCheck.qualityScore,
        streakDays:   rep?.current_streak ?? 0,
        metadata:     event.metadata,
      })

      // 6. Acreditar XP
      const { data: result, error: rpcError } = await this.supabase.db
        .rpc('award_xp', {
          p_user_id:    profile.id,
          p_event_type: event.eventType,
          p_platform:   event.platform,
          p_xp:         calculation.xpAwarded,
          p_base_xp:    calculation.baseXp,
          p_multiplier: calculation.multiplier,
          p_quality:    calculation.qualityScore,
          p_streak:     calculation.streakBonus,
          p_ref:        event.externalRef ?? null,
          p_metadata:   event.metadata ?? null,
        })

      if (rpcError) {
        this.logger.error(`award_xp error: ${rpcError.message}`)
        return { success: false, reason: 'DB_ERROR' }
      }

      const xpResult = result as {
        xp_awarded: number; total_xp: number
        old_level: number;  new_level: number; leveled_up: boolean
      }

      this.logger.log(
        `✅ XP: user=${profile.id} +${xpResult.xp_awarded} (${event.eventType}) total=${xpResult.total_xp}`
      )

      // 7. Eventos secundarios
      if (xpResult.leveled_up) {
        this.eventEmitter.emit('user.level_up', {
          userId: profile.id, discordId: event.discordId,
          oldLevel: xpResult.old_level, newLevel: xpResult.new_level,
        })
      }

      this.eventEmitter.emit('xp.awarded', {
        userId: profile.id, eventType: event.eventType,
      })

      return {
        success:   true,
        xpAwarded: xpResult.xp_awarded,
        newLevel:  xpResult.new_level,
        leveledUp: xpResult.leveled_up,
      }

    } catch (err) {
      this.logger.error(`processXpEvent error: ${err}`)
      return { success: false, reason: 'INTERNAL_ERROR' }
    }
  }
}
