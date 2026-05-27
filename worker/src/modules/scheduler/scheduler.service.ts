import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(private supabase: SupabaseService) {}

  /**
   * Actualizar streaks — corre cada día a las 02:00 AM
   * Recorre usuarios activos en las últimas 48h y actualiza sus rachas
   */
  @Cron('0 2 * * *')
  async updateDailyStreaks() {
    this.logger.log('Cron: actualizando streaks diarios...')

    try {
      // Usuarios activos en las últimas 48h
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

      const { data: activeUsers } = await this.supabase.db
        .from('xp_events')
        .select('user_id')
        .gte('created_at', cutoff)
        .order('user_id')

      if (!activeUsers?.length) return

      // Deduplicar user_ids
      const userIds = [...new Set(activeUsers.map(u => u.user_id))]
      this.logger.log(`Procesando streaks para ${userIds.length} usuarios`)

      // Llamar a la función SQL para cada usuario
      for (const userId of userIds) {
        await this.supabase.db.rpc('update_streak', { p_user_id: userId })
      }

      this.logger.log('✓ Streaks actualizados')
    } catch (err) {
      this.logger.error(`Error en updateDailyStreaks: ${err}`)
    }
  }

  /**
   * Reset XP semanal — corre cada lunes a las 00:00
   */
  @Cron('0 0 * * 1')
  async resetWeeklyXp() {
    this.logger.log('Cron: reset XP semanal...')
    try {
      await this.supabase.db.rpc('reset_weekly_xp')
      this.logger.log('✓ XP semanal reseteado')
    } catch (err) {
      this.logger.error(`Error en resetWeeklyXp: ${err}`)
    }
  }

  /**
   * Reset XP mensual — corre el 1° de cada mes a las 00:00
   */
  @Cron('0 0 1 * *')
  async resetMonthlyXp() {
    this.logger.log('Cron: reset XP mensual...')
    try {
      await this.supabase.db.rpc('reset_monthly_xp')
      this.logger.log('✓ XP mensual reseteado')
    } catch (err) {
      this.logger.error(`Error en resetMonthlyXp: ${err}`)
    }
  }

  /**
   * Verificar sorteos vencidos — corre cada hora
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredRaffles() {
    try {
      const { data: expired } = await this.supabase.db
        .from('raffles')
        .select('id, title')
        .eq('status', 'ACTIVE')
        .lt('ends_at', new Date().toISOString())

      for (const raffle of expired ?? []) {
        this.logger.log(`Sorteando raffle vencido: ${raffle.title}`)
        await this.supabase.db.rpc('draw_raffle', { p_raffle_id: raffle.id })
      }
    } catch (err) {
      this.logger.error(`Error en checkExpiredRaffles: ${err}`)
    }
  }
}
