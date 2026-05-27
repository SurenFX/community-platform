import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name)

  constructor(private supabase: SupabaseService) {}

  /**
   * Se dispara cada vez que se otorga XP.
   * Actualiza el progreso de misiones activas del usuario
   * que tengan el mismo objective_type que el evento.
   */
  @OnEvent('xp.awarded')
  async updateMissionProgress(payload: {
    userId:    string
    eventType: string
  }) {
    try {
      const now = new Date().toISOString()

      // Buscar misiones activas del usuario con ese objetivo
      const { data: userMissions } = await this.supabase.db
        .from('user_missions')
        .select('id, progress, missions!inner(id, target_count, xp_reward, ticket_reward, objective_type, ends_at)')
        .eq('user_id', payload.userId)
        .eq('is_completed', false)
        .eq('missions.objective_type', payload.eventType)
        .eq('missions.is_active', true)
        .gt('missions.ends_at', now)

      if (!userMissions?.length) return

      for (const um of userMissions) {
        const mission = (um as any).missions
        const newProgress = um.progress + 1

        if (newProgress >= mission.target_count) {
          // ✅ Misión completada
          await this.completeMission(payload.userId, um.id, mission)
        } else {
          // Actualizar progreso
          await this.supabase.db
            .from('user_missions')
            .update({ progress: newProgress })
            .eq('id', um.id)
        }
      }
    } catch (err) {
      this.logger.error(`updateMissionProgress error: ${err}`)
    }
  }

  private async completeMission(
    userId: string,
    userMissionId: string,
    mission: { id: string; xp_reward: number; ticket_reward: number }
  ) {
    // Marcar como completada
    await this.supabase.db
      .from('user_missions')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', userMissionId)

    // Otorgar recompensas
    await this.supabase.db
      .from('user_reputation')
      .update({
        total_xp:      this.supabase.db.rpc as any, // se hace via RPC
        raffle_tickets: this.supabase.db.rpc as any,
      })

    // Usar RPC para atomicidad
    if (mission.xp_reward > 0) {
      await this.supabase.db.rpc('award_xp', {
        p_user_id:    userId,
        p_event_type: 'MISSION_COMPLETED',
        p_platform:   'DISCORD',
        p_xp:         mission.xp_reward,
        p_base_xp:    mission.xp_reward,
        p_multiplier: 1.0,
        p_quality:    1.0,
        p_streak:     1.0,
        p_ref:        mission.id,
        p_metadata:   { mission_id: mission.id },
      })
    }

    // Otorgar tickets
    if (mission.ticket_reward > 0) {
      await this.supabase.db
        .from('user_reputation')
        .update({ raffle_tickets: { increment: mission.ticket_reward } as any })
        .eq('user_id', userId)
    }

    this.logger.log(`Mission completed: user=${userId} mission=${mission.id} xp=${mission.xp_reward}`)
  }

  /**
   * Asegura que el usuario tenga registros en user_missions
   * para todas las misiones activas (se llama al primer evento del día)
   */
  async enrollUserInActiveMissions(userId: string) {
    const now = new Date().toISOString()

    const { data: activeMissions } = await this.supabase.db
      .from('missions')
      .select('id')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gt('ends_at', now)

    if (!activeMissions?.length) return

    // Upsert — no falla si ya existe
    const inserts = activeMissions.map(m => ({
      user_id:    userId,
      mission_id: m.id,
      progress:   0,
    }))

    await this.supabase.db
      .from('user_missions')
      .upsert(inserts, { onConflict: 'user_id,mission_id', ignoreDuplicates: true })
  }
}
