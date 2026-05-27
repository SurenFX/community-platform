import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name)
  private readonly channelId = 'UCrEPUgjVon78Htzr_ZrJ7ug'
  private readonly apiBase  = 'https://www.googleapis.com/youtube/v3'

  constructor(
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private reputation: ReputationService,
  ) {}

  private get apiKey(): string {
    return this.config.get<string>('YOUTUBE_API_KEY') ?? ''
  }

  // ── Verificar suscripción de un usuario ───────────────────
  async checkSubscription(userId: string, accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.apiBase}/subscriptions?part=snippet&mine=true&forChannelId=${this.channelId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await res.json()
      return data.items?.length > 0
    } catch (err) {
      this.logger.warn(`checkSubscription error: ${err}`)
      return false
    }
  }

  // ── Verificar y recompensar suscripción ───────────────────
  async rewardSubscription(userId: string, discordId: string, accessToken: string) {
    try {
      // Verificar si ya fue recompensado por suscribirse
      const { data: existing } = await this.supabase.db
        .from('xp_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'YOUTUBE_SUBSCRIBE')
        .single()

      if (existing) return // ya fue recompensado

      const isSubscribed = await this.checkSubscription(userId, accessToken)
      if (!isSubscribed) return

      await this.reputation.processXpEvent({
        discordId,
        eventType:   'YOUTUBE_SUBSCRIBE',
        platform:    'YOUTUBE',
        externalRef: this.channelId,
        metadata:    { channel_id: this.channelId },
      })

      this.logger.log(`YouTube sub reward: user=${userId}`)
    } catch (err) {
      this.logger.error(`rewardSubscription error: ${err}`)
    }
  }

  // ── Escanear comentarios nuevos en videos del canal ───────
  // Corre cada 30 minutos buscando comentarios nuevos
  @Cron('*/30 * * * *')
  async scanNewComments() {
    if (!this.apiKey) {
      this.logger.warn('YOUTUBE_API_KEY no configurada — scanning desactivado')
      return
    }

    try {
      this.logger.log('Escaneando comentarios de YouTube...')

      // 1. Obtener usuarios con YouTube conectado
      const { data: socialLinks } = await this.supabase.db
        .from('user_social_links')
        .select('user_id, external_id, username')
        .eq('platform', 'YOUTUBE')

      if (!socialLinks?.length) return

      // Mapa de youtube_channel_id → {userId, discordId}
      const ytUserMap = new Map<string, { userId: string; discordId: string }>()

      for (const link of socialLinks) {
        // Obtener discord_id del perfil
        const { data: profile } = await this.supabase.db
          .from('profiles')
          .select('discord_id')
          .eq('id', link.user_id)
          .single()

        if (profile) {
          ytUserMap.set(link.external_id, {
            userId:   link.user_id,
            discordId: profile.discord_id,
          })
        }
      }

      // 2. Obtener videos recientes del canal (últimos 7 días)
      const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const videosRes = await fetch(
        `${this.apiBase}/search?part=id&channelId=${this.channelId}&type=video&publishedAfter=${publishedAfter}&maxResults=10&key=${this.apiKey}`
      )
      const videosData = await videosRes.json()
      const videoIds: string[] = videosData.items?.map((v: any) => v.id.videoId) ?? []

      if (!videoIds.length) return

      // 3. Para cada video, buscar comentarios de usuarios registrados
      for (const videoId of videoIds) {
        await this.scanVideoComments(videoId, ytUserMap)
      }

    } catch (err) {
      this.logger.error(`scanNewComments error: ${err}`)
    }
  }

  private async scanVideoComments(
    videoId: string,
    ytUserMap: Map<string, { userId: string; discordId: string }>
  ) {
    try {
      const res = await fetch(
        `${this.apiBase}/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${this.apiKey}`
      )
      const data = await res.json()

      for (const item of data.items ?? []) {
        const comment    = item.snippet.topLevelComment.snippet
        const authorId   = comment.authorChannelId?.value
        const commentId  = item.id
        const commentText = comment.textDisplay

        if (!authorId || !ytUserMap.has(authorId)) continue

        const { userId, discordId } = ytUserMap.get(authorId)!

        // Verificar que no hayamos recompensado este comentario antes
        const { data: existing } = await this.supabase.db
          .from('xp_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'YOUTUBE_COMMENT')
          .eq('external_ref', commentId)
          .single()

        if (existing) continue // ya recompensado

        await this.reputation.processXpEvent({
          discordId,
          eventType:   'YOUTUBE_COMMENT',
          platform:    'YOUTUBE',
          externalRef: commentId,
          metadata: {
            video_id:    videoId,
            comment_id:  commentId,
            comment_text: commentText.slice(0, 200),
          },
        })

        this.logger.log(`YouTube comment reward: user=${userId} video=${videoId}`)
      }
    } catch (err) {
      this.logger.warn(`scanVideoComments error for ${videoId}: ${err}`)
    }
  }

  // ── Llamado cuando un usuario conecta YouTube ─────────────
  async onUserConnected(userId: string, discordId: string, accessToken: string, ytChannelId: string) {
    try {
      // Guardar el link de YouTube
      await this.supabase.db
        .from('user_social_links')
        .upsert({
          user_id:     userId,
          platform:    'YOUTUBE',
          external_id: ytChannelId,
          username:    ytChannelId,
          is_verified: true,
        }, { onConflict: 'user_id,platform' })

      // Verificar suscripción inmediatamente
      await this.rewardSubscription(userId, discordId, accessToken)

    } catch (err) {
      this.logger.error(`onUserConnected error: ${err}`)
    }
  }
}
