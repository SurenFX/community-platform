import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

interface BadgeCondition {
  type:   string
  level?: number
  count?: number
  event?: string
  days?:  number
  date?:  string
  stat?:  string
  value?: number
}

interface BadgeRow {
  id:        string
  slug:      string
  name:      string
  condition: BadgeCondition
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name)

  constructor(private supabase: SupabaseService) {}

  // ── Punto de entrada principal ──────────────────────────────────────────────
  // Llamado desde ReputationService después de acreditar XP
  async checkAndAwardBadges(userId: string, context: {
    newLevel?:        number
    eventType?:       string
    currentStreak?:   number
    twitchMinutes?:   number
    joinedAt?:        string
  }): Promise<string[]> {
    const awarded: string[] = []

    try {
      // Obtener todos los badges que el usuario todavía NO tiene
      const { data: allBadges } = await this.supabase.db
        .from('badges')
        .select('id, slug, name, condition')
        .eq('is_secret', false)

      if (!allBadges?.length) return awarded

      const { data: earned } = await this.supabase.db
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId)

      const earnedIds = new Set((earned ?? []).map((b: any) => b.badge_id))
      const pending   = (allBadges as BadgeRow[]).filter(b => !earnedIds.has(b.id))

      for (const badge of pending) {
        const qualifies = await this.evaluateCondition(userId, badge.condition, context)
        if (qualifies) {
          const { error } = await this.supabase.db
            .from('user_badges')
            .insert({ user_id: userId, badge_id: badge.id })

          if (!error) {
            awarded.push(badge.slug)
            this.logger.log(`🏅 Badge otorgado: ${badge.slug} → user=${userId}`)
          }
        }
      }
    } catch (err) {
      this.logger.error(`checkAndAwardBadges error: ${err}`)
    }

    return awarded
  }

  // ── Evaluador de condiciones ────────────────────────────────────────────────
  private async evaluateCondition(
    userId:    string,
    condition: BadgeCondition,
    context:   Record<string, any>,
  ): Promise<boolean> {
    switch (condition.type) {

      // Nivel alcanzado — level_reached
      case 'level_reached':
        return (context.newLevel ?? 0) >= (condition.level ?? 999)

      // Racha de días — streak_reached
      case 'streak_reached':
        return (context.currentStreak ?? 0) >= (condition.days ?? 999)

      // Unirse antes de una fecha — join_before
      case 'join_before': {
        if (!context.joinedAt || !condition.date) return false
        return new Date(context.joinedAt) < new Date(condition.date)
      }

      // Cantidad de un evento específico — xp_event_count
      case 'xp_event_count': {
        if (!condition.event || !condition.count) return false
        // Si el evento actual es del tipo requerido, consultar el total acumulado
        if (context.eventType !== condition.event) return false
        const { count } = await this.supabase.db
          .from('xp_events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('event_type', condition.event)
        return (count ?? 0) >= condition.count
      }

      // Misiones completadas — missions_completed
      case 'missions_completed': {
        if (!condition.count) return false
        const { count } = await this.supabase.db
          .from('user_missions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_completed', true)
        return (count ?? 0) >= condition.count
      }

      // Umbral de stat — stat_threshold
      case 'stat_threshold': {
        if (!condition.stat || !condition.value) return false
        if (condition.stat === 'twitch_minutes') {
          return (context.twitchMinutes ?? 0) >= condition.value
        }
        return false
      }

      default:
        return false
    }
  }
}
