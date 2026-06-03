import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { StreakService } from '../reputation/streak.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private supabase: SupabaseService,
    private streak:   StreakService,
  ) {}

  /**
   * Actualizar streaks — corre cada día a las 02:00 AM
   * Recorre usuarios activos en las últimas 48h y actualiza sus rachas
   */
  @Cron('0 2 * * *')
  async updateDailyStreaks() {
    this.logger.log('Cron: reseteando streaks de usuarios inactivos...')
    await this.streak.resetInactiveStreaks()
    this.logger.log('✓ Streaks actualizados')
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
   * Reset misiones DAILY — corre cada día a las 00:00
   * Elimina el progreso de user_missions completadas o en curso del tipo DAILY
   */
  @Cron('0 0 * * *')
  async resetDailyMissions() {
    this.logger.log('Cron: reseteando misiones diarias...')
    try {
      await this.supabase.db
        .from('user_missions')
        .delete()
        .in('mission_id',
          this.supabase.db
            .from('missions')
            .select('id')
            .eq('type', 'DAILY') as any
        )
      this.logger.log('✓ Misiones diarias reseteadas')
    } catch (err) {
      this.logger.error(`Error en resetDailyMissions: ${err}`)
    }
  }

  /**
   * Reset misiones WEEKLY — corre cada lunes a las 00:00
   */
  @Cron('0 0 * * 1')
  async resetWeeklyMissions() {
    this.logger.log('Cron: reseteando misiones semanales...')
    try {
      await this.supabase.db
        .from('user_missions')
        .delete()
        .in('mission_id',
          this.supabase.db
            .from('missions')
            .select('id')
            .eq('type', 'WEEKLY') as any
        )
      this.logger.log('✓ Misiones semanales reseteadas')
    } catch (err) {
      this.logger.error(`Error en resetWeeklyMissions: ${err}`)
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
