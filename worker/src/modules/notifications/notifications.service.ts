import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(private supabase: SupabaseService) {}

  async create(userId: string, type: string, title: string, message: string) {
    try {
      await this.supabase.db
        .from('notifications')
        .insert({ user_id: userId, type, title, message })
    } catch (err) {
      this.logger.warn(`Error creando notificación: ${err}`)
    }
  }

  @OnEvent('user.level_up')
  async onLevelUp(payload: { userId: string; oldLevel: number; newLevel: number }) {
    await this.create(
      payload.userId,
      'LEVEL_UP',
      `⬆️ ¡Subiste al nivel ${payload.newLevel}!`,
      `Pasaste del nivel ${payload.oldLevel} al ${payload.newLevel}. ¡Seguí así!`,
    )
  }

  @OnEvent('badge.earned')
  async onBadgeEarned(payload: { userId: string; badges: string[] }) {
    for (const slug of payload.badges) {
      // Obtener nombre del badge
      const { data: badge } = await this.supabase.db
        .from('badges')
        .select('name, tier')
        .eq('slug', slug)
        .single()

      const name = (badge as any)?.name ?? slug
      const tier = (badge as any)?.tier ?? ''

      await this.create(
        payload.userId,
        'BADGE_EARNED',
        `🏅 ¡Badge desbloqueado!`,
        `Obtuviste el badge "${name}"${tier ? ` (${tier})` : ''}.`,
      )
    }
  }

  @OnEvent('mission.completed')
  async onMissionCompleted(payload: { userId: string; missionTitle: string; xpReward: number; ticketReward: number }) {
    const extras: string[] = []
    if (payload.xpReward    > 0) extras.push(`+${payload.xpReward} XP`)
    if (payload.ticketReward > 0) extras.push(`+${payload.ticketReward} tickets`)

    await this.create(
      payload.userId,
      'MISSION_COMPLETED',
      `🎯 ¡Misión completada!`,
      `Completaste "${payload.missionTitle}"${extras.length ? `. Recompensa: ${extras.join(', ')}` : ''}.`,
    )
  }
}
