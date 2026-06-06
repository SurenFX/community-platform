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
  // Auto-acepta misiones que el usuario no tenga y avanza las que ya tiene
  @OnEvent('xp.awarded')
  async updateMissionProgress(payload: { userId: string; eventType: string }) {
    try {
      const now = new Date().toISOString()

      // 1. Obtener todas las misiones activas del tipo de evento
      const { data: allMissions } = await this.supabase.db
        .from('missions')
        .select('id, title, target_count, xp_reward, coin_reward, ends_at')
        .eq('objective_type', payload.eventType)
        .eq('is_active', true)
        .gt('ends_at', now)

      if (!allMissions?.length) return

      // 2. Obtener user_missions existentes para este usuario y estas misiones
      const missionIds = allMissions.map(m => m.id)
      const { data: existingUMs } = await this.supabase.db
        .from('user_missions')
        .select('id, mission_id, progress, is_completed')
        .eq('user_id', payload.userId)
        .in('mission_id', missionIds)

      const existingMap = new Map((existingUMs ?? []).map(um => [um.mission_id, um]))

      for (const mission of allMissions) {
        const existing = existingMap.get(mission.id)

        if (!existing) {
          // ── Auto-aceptar: crear user_mission con progreso = 1 ────────────
          const newProgress = 1
          const completed   = newProgress >= mission.target_count

          const { data: newUM, error } = await this.supabase.db
            .from('user_missions')
            .insert({
              user_id:      payload.userId,
              mission_id:   mission.id,
              progress:     completed ? mission.target_count : newProgress,
              is_completed: completed,
              is_claimed:   false,
              completed_at: completed ? new Date().toISOString() : null,
            })
            .select('id')
            .single()

          if (error) {
            this.logger.warn(`Auto-accept error mission=${mission.id}: ${error.message}`)
            continue
          }

          if (completed) {
            this.logger.log(`🎯 Misión auto-completada: user=${payload.userId} "${mission.title}"`)
            this.eventEmitter.emit('mission.ready_to_claim', {
              userId:       payload.userId,
              missionTitle: mission.title ?? 'Misión',
              xpReward:     mission.xp_reward,
              coinReward:   mission.coin_reward ?? 0,
            })
          } else {
            this.logger.debug(`Mission auto-accepted: user=${payload.userId} "${mission.title}" (1/${mission.target_count})`)
          }

        } else if (!existing.is_completed) {
          // ── Avanzar progreso en misión ya existente ──────────────────────
          const newProgress = existing.progress + 1

          if (newProgress >= mission.target_count) {
            await this.supabase.db
              .from('user_missions')
              .update({
                is_completed: true,
                progress:     mission.target_count,
                completed_at: new Date().toISOString(),
              })
              .eq('id', existing.id)

            this.logger.log(`🎯 Misión completada (por reclamar): user=${payload.userId} "${mission.title}"`)

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
              .eq('id', existing.id)

            this.logger.debug(`Mission progress: user=${payload.userId} "${mission.title}" (${newProgress}/${mission.target_count})`)
          }
        }
        // Si already is_completed → no hacer nada (esperando que reclame)
      }
    } catch (err) {
      this.logger.error(`updateMissionProgress error: ${err}`)
    }
  }
}
