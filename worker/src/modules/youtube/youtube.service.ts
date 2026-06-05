import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name)
  private readonly channelId = 'UCrEPUgjVon78Htzr_ZrJ7ug'
  private readonly apiBase  = 'https://www.googleapis.com/youtube/v3'

  constructor(
    private config:      ConfigService,
    private supabase:    SupabaseService,
    private reputation:  ReputationService,
    private discordBot:  DiscordBotService,
    private redis:       RedisService,
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

      // 2. Obtener videos de los últimos 7 días
      const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const videosRes = await fetch(
        `${this.apiBase}/search?part=id,snippet&channelId=${this.channelId}&type=video&publishedAfter=${publishedAfter}&maxResults=10&key=${this.apiKey}`
      )
      const videosData = await videosRes.json()
      const videoItems: any[] = videosData.items ?? []
      const videoIds: string[] = videoItems.map((v: any) => v.id.videoId)

      if (!videoIds.length) return

      // 2b. Obtener duración de los videos para filtrar VODs (>1 hora)
      const detailsRes = await fetch(
        `${this.apiBase}/videos?part=contentDetails&id=${videoIds.join(',')}&key=${this.apiKey}`
      )
      const detailsData = await detailsRes.json()
      const durationMap = new Map<string, number>()
      for (const item of detailsData.items ?? []) {
        durationMap.set(item.id, this.parseDurationSeconds(item.contentDetails?.duration ?? ''))
      }

      // 2c. Anunciar videos nuevos en Discord — excluir VODs (>60 min)
      const discordChannelId = this.config.get<string>('DISCORD_YOUTUBE_CHANNEL_ID')
      if (discordChannelId) {
        for (const item of videoItems) {
          const videoId     = item.id.videoId
          const title       = item.snippet?.title ?? 'Nuevo video'
          const publishedAt = item.snippet?.publishedAt ?? ''
          const thumbnail   = item.snippet?.thumbnails?.high?.url ?? ''
          const duration    = durationMap.get(videoId) ?? 0

          // Saltar VODs (más de 60 minutos)
          if (duration > 60 * 60) {
            this.logger.log(`YouTube: saltando VOD ${videoId} (${Math.round(duration/60)} min) - ${title}`)
            // Marcar igual para no procesarlo de nuevo
            await this.redis.setNX(`yt:announced:${videoId}`, 'vod', 30 * 24 * 60 * 60)
            continue
          }

          const isNew = await this.redis.setNX(
            `yt:announced:${videoId}`,
            '1',
            30 * 24 * 60 * 60
          )

          if (isNew) {
            const embed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle(`🎬 ¡Nuevo video! ${title}`)
              .setURL(`https://youtube.com/watch?v=${videoId}`)
              .setTimestamp(new Date(publishedAt))

            if (thumbnail) embed.setImage(thumbnail)

            await this.discordBot.announce(discordChannelId, embed, '@everyone')
            this.logger.log(`YouTube: anunciado video nuevo ${videoId} - ${title}`)
          }
        }
      }

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

        // ── Primero en comentar en un video nuevo ─────────────────────────
        const isFirstComment = await this.redis.setNX(`yt:first_comment:${videoId}`, '1', 30 * 24 * 60 * 60)
        if (isFirstComment) {
          try {
            await this.supabase.db
              .from('notifications')
              .insert({
                user_id: userId,
                type:    'FIRST_COMMENTER',
                title:   '🎬 ¡Primero en comentar!',
                message: `Fuiste el primero en comentar en un video nuevo del canal. ¡+100 XP y +50 SC!`,
              })

            await this.supabase.db.rpc('award_xp', {
              p_user_id:    userId,
              p_event_type: 'YOUTUBE_COMMENT',
              p_platform:   'YOUTUBE',
              p_xp:         100,
              p_base_xp:    100,
              p_multiplier: 1.0,
              p_quality:    1.0,
              p_streak:     0,
              p_ref:        `first_comment_${videoId}`,
            })

            const { data: rep } = await this.supabase.db
              .from('user_reputation')
              .select('salchi_coins')
              .eq('user_id', userId)
              .single()

            await this.supabase.db
              .from('user_reputation')
              .update({ salchi_coins: ((rep as any)?.salchi_coins ?? 0) + 50 })
              .eq('user_id', userId)

            this.logger.log(`First commenter on video ${videoId}: user=${userId}`)
          } catch (err) {
            this.logger.warn(`First commenter error: ${err}`)
          }
        }

        this.logger.log(`YouTube comment reward: user=${userId} video=${videoId}`)
      }
    } catch (err) {
      this.logger.warn(`scanVideoComments error for ${videoId}: ${err}`)
    }
  }

  // ── Parsear duración ISO 8601 a segundos ─────────────────
  private parseDurationSeconds(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    const h = parseInt(match[1] ?? '0')
    const m = parseInt(match[2] ?? '0')
    const s = parseInt(match[3] ?? '0')
    return h * 3600 + m * 60 + s
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
