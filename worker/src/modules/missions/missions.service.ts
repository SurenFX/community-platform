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
  // Solo actualiza progreso de misiones que el usuario YA aceptó
  @OnEvent('xp.awarded')
  async updateMissionProgress(payload: { userId: string; eventType: string }) {
    try {
      const now = new Date().toISOString()

      // Buscar user_missions aceptadas (is_completed=false) del tipo de evento
      const { data: userMissions } = await this.supabase.db
        .from('user_missions')
        .select('id, progress, missions!inner(id, title, target_count, xp_reward, coin_reward, ends_at)')
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
          // Marcar como completada — recompensas se dan al reclamar
          await this.supabase.db
            .from('user_missions')
            .update({
              is_completed: true,
              progress:     mission.target_count,
              completed_at: new Date().toISOString(),
            })
            .eq('id', um.id)

          this.logger.log(`🎯 Misión completada (por reclamar): user=${payload.userId} "${mission.title}"`)

          // Notificar que hay una misión lista para reclamar
          this.eventEmitter.emit('mission.ready_to_claim', {
            userId:       payload.userId,
            missionTitle: mission.title ?? 'Misión',
            xpReward:     mission.xp_reward,
            coinReward:   mission.coin_reward ?? 0,
          })
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
}
