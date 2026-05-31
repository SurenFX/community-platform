import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name)

  constructor(private supabase: SupabaseService) {}

  // ── Llamado desde ReputationService en cada evento de XP exitoso ───────────
  async updateStreak(userId: string): Promise<{ streakChanged: boolean; currentStreak: number }> {
    try {
      const { data: rep } = await this.supabase.db
        .from('user_reputation')
        .select('current_streak, longest_streak, last_active_date')
        .eq('user_id', userId)
        .single()

      if (!rep) return { streakChanged: false, currentStreak: 0 }

      const today     = this.todayUTC()
      const lastDate  = rep.last_active_date ? rep.last_active_date.slice(0, 10) : null

      // Ya se contabilizó hoy — nada que hacer
      if (lastDate === today) {
        return { streakChanged: false, currentStreak: rep.current_streak }
      }

      const yesterday = this.yesterdayUTC()
      let newStreak: number

      if (lastDate === yesterday) {
        // Actividad consecutiva — incrementar
        newStreak = rep.current_streak + 1
      } else {
        // Más de un día sin actividad (o primer día) — reiniciar
        newStreak = 1
      }

      const newLongest = Math.max(newStreak, rep.longest_streak ?? 0)

      await this.supabase.db
        .from('user_reputation')
        .update({
          current_streak:   newStreak,
          longest_streak:   newLongest,
          last_active_date: today,
        })
        .eq('user_id', userId)

      this.logger.log(`🔥 Streak: user=${userId} ${rep.current_streak}→${newStreak}`)
      return { streakChanged: true, currentStreak: newStreak }

    } catch (err) {
      this.logger.warn(`updateStreak error: ${err}`)
      return { streakChanged: false, currentStreak: 0 }
    }
  }

  // ── Cron diario: resetear streaks de usuarios inactivos ───────────────────
  // Llamado desde SchedulerService a medianoche UTC
  async resetInactiveStreaks(): Promise<void> {
    try {
      const yesterday = this.yesterdayUTC()

      // Usuarios cuya última actividad fue antes de ayer (perdieron el streak)
      const { data: stale, error } = await this.supabase.db
        .from('user_reputation')
        .select('user_id, current_streak')
        .not('last_active_date', 'is', null)
        .lt('last_active_date', yesterday)
        .gt('current_streak', 0)

      if (error || !stale?.length) return

      // Resetear en batch
      const ids = stale.map((r: any) => r.user_id)
      await this.supabase.db
        .from('user_reputation')
        .update({ current_streak: 0 })
        .in('user_id', ids)

      this.logger.log(`Reset streaks: ${ids.length} usuarios inactivos`)
    } catch (err) {
      this.logger.warn(`resetInactiveStreaks error: ${err}`)
    }
  }

  private todayUTC(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private yesterdayUTC(): string {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }
}
