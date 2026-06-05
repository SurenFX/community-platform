import { Injectable, Logger } from '@nestjs/common'
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name)

  constructor(
    private supabase:      SupabaseService,
    private eventEmitter:  EventEmitter2,
  ) {}

  // ── Se dispara en cada evento de XP exitoso ─────────────────────────────
  @OnEvent('xp.awarded')
  async updateMissionProgress(payload: { userId: string; eventType: string }) {
    try {
      // 1. Asegurar que el usuario esté inscripto en misiones activas
      await this.enrollUserInActiveMissions(payload.userId)

      const now = new Date().toISOString()

      // 2. Buscar user_missions activas con objetivo = este tipo de evento
      const { data: userMissions } = await this.supabase.db
        .from('user_missions')
        .select('id, progress, missions!inner(id, title, target_count, xp_reward, coin_reward, ticket_reward, ends_at)')
        .eq('user_id',                  payload.userId)
        .eq('is_completed',             false)
        .eq('missions.objective_type',  payload.eventType)
        .eq('missions.is_active',       true)
        .gt('missions.ends_at',         now)

      if (!userMissions?.length) return

      for (const um of userMissions as any[]) {
        const mission     = um.missions
        const newProgress = um.progress + 1

        if (newProgress >= mission.target_count) {
          await this.completeMission(payload.userId, um.id, mission)
        } else {
          await this.supabase.db
            .from('user_missions')
            .update({ progress: newProgress })
            .eq('id', um.id)

          this.logger.debug(`Mission progress: user=${payload.userId} +1 (${newProgress}/${mission.target_count})`)
        }
      }
    } catch (err) {
      this.logger.error(`updateMissionProgress error: ${err}`)
    }
  }

  // ── Completar misión + otorgar recompensas ──────────────────────────────
  private async completeMission(
    userId:        string,
    userMissionId: string,
    mission:       { id: string; title?: string; xp_reward: number; coin_reward: number; ticket_reward: number; target_count: number }
  ) {
    // Marcar completada
    await this.supabase.db
      .from('user_missions')
      .update({
        is_completed: true,
        progress:     mission.target_count ?? 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', userMissionId)

    // Otorgar XP de recompensa vía RPC
    if (mission.xp_reward > 0) {
      await this.supabase.db.rpc('award_xp', {
        p_user_id:    userId,
        p_event_type: 'MISSION_COMPLETED',
        p_platform:   'DISCORD',
        p_xp:         mission.xp_reward,
        p_base_xp:    mission.xp_reward,
        p_multiplier: 1.0,
        p_quality:    1.0,
        p_streak:     0,
        p_ref:        mission.id,
        p_metadata:   { mission_id: mission.id },
      })
    }

    // Otorgar SalchiCoins
    if ((mission.coin_reward ?? 0) > 0) {
      const { data: rep } = await this.supabase.db
        .from('user_reputation')
        .select('salchi_coins')
        .eq('user_id', userId)
        .single()

      const current = (rep as any)?.salchi_coins ?? 0
      await this.supabase.db
        .from('user_reputation')
        .update({ salchi_coins: current + mission.coin_reward })
        .eq('user_id', userId)

      this.logger.log(`🪙 SC: user=${userId} +${mission.coin_reward} SalchiCoins`)
    }

    this.logger.log(
      `✅ Misión completada: user=${userId} xp=+${mission.xp_reward} sc=+${mission.coin_reward}`
    )

    this.eventEmitter.emit('mission.completed', {
      userId,
      missionTitle: mission.title ?? 'Misión',
      xpReward:     mission.xp_reward,
      coinReward:   mission.coin_reward ?? 0,
    })
  }

  // ── Inscribir usuario en todas las misiones activas que no tenga aún ────
  async enrollUserInActiveMissions(userId: string) {
    const now = new Date().toISOString()

    const { data: activeMissions } = await this.supabase.db
      .from('missions')
      .select('id')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gt('ends_at', now)

    if (!activeMissions?.length) return

    // Obtener en qué misiones ya está inscripto
    const { data: existing } = await this.supabase.db
      .from('user_missions')
      .select('mission_id')
      .eq('user_id', userId)

    const existingIds = new Set((existing ?? []).map((um: any) => um.mission_id))
    const toInsert    = activeMissions
      .filter((m: any) => !existingIds.has(m.id))
      .map((m: any) => ({ user_id: userId, mission_id: m.id, progress: 0 }))

    if (toInsert.length > 0) {
      await this.supabase.db.from('user_missions').insert(toInsert)
      this.logger.debug(`Enrolled user=${userId} in ${toInsert.length} missions`)
    }
  }
}
