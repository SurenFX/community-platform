import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { TwitchIrcService } from '../twitch/twitch-irc.service'
import { KickApiService } from '../kick/kick-api.service'

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
    private telegram:    TelegramService,
    private redis:       RedisService,
    private twitchIrc:   TwitchIrcService,
    private kickApi:     KickApiService,
  ) {}

  private get apiKey(): string {
    return this.config.get<string>('YOUTUBE_API_KEY') ?? ''
  }

  // ── Verificar suscripcion de un usuario ───────────────────
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

  // ── Verificar y recompensar suscripcion ───────────────────
  async rewardSubscription(userId: string, discordId: string, accessToken: string) {
    try {
      const { data: existing } = await this.supabase.db
        .from('xp_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'YOUTUBE_SUBSCRIBE')
        .single()

      if (existing) return

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
      this.logger.warn('YOUTUBE_API_KEY no configurada -- scanning desactivado')
      return
    }

    try {
      this.logger.log('Escaneando comentarios de YouTube...')

      // 1. Obtener usuarios con YouTube conectado
      const { data: socialLinks } = await this.supabase.db
        .from('user_social_links')
        .select('user_id, external_id, username, created_at')
        .eq('platform', 'YOUTUBE')

      const ytUserMap = new Map<string, { userId: string; discordId: string; connectedAt: string }>()

      for (const link of socialLinks ?? []) {
        const { data: profile } = await this.supabase.db
          .from('profiles')
          .select('discord_id')
          .eq('id', link.user_id)
          .single()

        if (profile) {
          ytUserMap.set(link.external_id, {
            userId:      link.user_id,
            discordId:   profile.discord_id,
            connectedAt: link.created_at ?? new Date(0).toISOString(),
          })
        }
      }

      // 2. Obtener videos de los ultimos 7 dias
      const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const videosRes = await fetch(
        `${this.apiBase}/search?part=id,snippet&channelId=${this.channelId}&type=video&publishedAfter=${publishedAfter}&maxResults=10&key=${this.apiKey}`
      )
      const videosData = await videosRes.json()

      if (videosData.error) {
        this.logger.error(`YouTube search.list error: ${JSON.stringify(videosData.error)}`)
      }

      const videoItems: any[] = videosData.items ?? []
      const videoIds: string[] = videoItems.map((v: any) => v.id.videoId)

      this.logger.log(`YouTube: ${videoIds.length} video(s) encontrados en los ultimos 7 dias`)

      if (!videoIds.length) return

      // 2b. Obtener duracion de los videos para filtrar VODs (>1 hora)
      const detailsRes = await fetch(
        `${this.apiBase}/videos?part=contentDetails&id=${videoIds.join(',')}&key=${this.apiKey}`
      )
      const detailsData = await detailsRes.json()

      if (detailsData.error) {
        this.logger.error(`YouTube videos.list error: ${JSON.stringify(detailsData.error)}`)
      }

      const durationMap = new Map<string, number>()
      for (const item of detailsData.items ?? []) {
        durationMap.set(item.id, this.parseDurationSeconds(item.contentDetails?.duration ?? ''))
      }

      // 2c. Anunciar videos nuevos en Discord y Telegram -- excluir VODs (>60 min)
      const discordChannelId = this.config.get<string>('DISCORD_YOUTUBE_CHANNEL_ID')

      if (!discordChannelId) {
        this.logger.warn('DISCORD_YOUTUBE_CHANNEL_ID no configurado -- se omitira el anuncio en Discord')
      }

      // Deteccion de live activo (para anuncios en chat de Twitch/Kick)
      // twitch:live:{channel} y kick:live:{slug} se setean cuando hay stream en vivo
      const twitchChannel = this.config.get<string>('TWITCH_CHANNEL') ?? ''
      const kickSlug      = this.config.get<string>('KICK_CHANNEL_SLUG') ?? ''
      const twitchLive    = twitchChannel ? await this.redis.get(`twitch:live:${twitchChannel}`) : null
      const kickLive      = kickSlug      ? await this.redis.get(`kick:live:${kickSlug}`)        : null
      const isAnyLive     = !!(twitchLive || kickLive)

      // Inicio del dia UTC -- solo anunciamos en chat videos de hoy en adelante
      const todayUtc = new Date()
      todayUtc.setUTCHours(0, 0, 0, 0)

      for (const item of videoItems) {
        const videoId     = item.id.videoId
        const title       = item.snippet?.title ?? 'Nuevo video'
        const publishedAt = item.snippet?.publishedAt ?? ''
        const thumbnail   = item.snippet?.thumbnails?.high?.url ?? ''
        const duration    = durationMap.get(videoId) ?? 0

        // Saltar VODs (mas de 60 minutos)
        if (duration > 60 * 60) {
          this.logger.log(`YouTube: saltando VOD ${videoId} (${Math.round(duration/60)} min) - ${title}`)
          await this.redis.setNX(`yt:announced:${videoId}`, 'vod', 30 * 24 * 60 * 60)
          continue
        }

        // ── Discord / Telegram -- una sola vez por video nuevo ──
        const isNew = await this.redis.setNX(
          `yt:announced:${videoId}`,
          '1',
          30 * 24 * 60 * 60
        )

        this.logger.log(`YouTube: video ${videoId} (${title}) - nuevo=${isNew}`)

        if (isNew) {
          if (discordChannelId) {
            const embed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle(`Nuevo video! ${title}`)
              .setURL(`https://youtube.com/watch?v=${videoId}`)
              .setTimestamp(new Date(publishedAt))

            if (thumbnail) embed.setImage(thumbnail)

            await this.discordBot.announce(discordChannelId, embed, '@everyone')
          }

          await this.telegram.announce(
            `Nuevo video! ${title}\n\n` +
            `Ver en YouTube: https://youtube.com/watch?v=${videoId}`,
            'TELEGRAM_YOUTUBE_THREAD_ID'
          )

          this.logger.log(`YouTube: anunciado video nuevo ${videoId} - ${title}`)
        }

        // ── Chat de Twitch y Kick -- solo videos de hoy en adelante ──
        //
        // Ciclo de vida de un video en chat:
        //   yt:chat_last:{id}  -- timestamp del ultimo post (TTL 48h)
        //                         se setea durante el live, se borra al cerrar sesion
        //   yt:chat_done:{id}  -- flag permanente (30 dias)
        //                         se setea cuando el live termina y el video ya fue anunciado
        //                         con esto el proximo live NO lo vuelve a mencionar
        if (!publishedAt || new Date(publishedAt) < todayUtc) continue

        const isDone = await this.redis.get(`yt:chat_done:${videoId}`)
        if (isDone) continue  // ya fue recordado en un live anterior

        if (isAnyLive) {
          // Durante el live: recordar cada ~1 hora
          const lastStr = await this.redis.get(`yt:chat_last:${videoId}`)
          const lastTs  = lastStr ? parseInt(lastStr, 10) : 0
          const ONE_HOUR = 60 * 60 * 1000

          if (Date.now() - lastTs >= ONE_HOUR) {
            const chatMsg = `Nuevo video! "${title}" -> https://youtube.com/watch?v=${videoId}`
            this.twitchIrc.sendChat(chatMsg)
            await this.kickApi.sendChat(chatMsg)
            await this.redis.set(`yt:chat_last:${videoId}`, String(Date.now()), 48 * 60 * 60)
            this.logger.log(`YouTube: video recordado en chat (live): ${videoId}`)
          }
        } else {
          // Stream offline: si ya fue anunciado en un live previo, marcarlo como listo
          // para que el proximo live no lo vuelva a mencionar
          const wasAnnounced = await this.redis.get(`yt:chat_last:${videoId}`)
          if (wasAnnounced) {
            await this.redis.set(`yt:chat_done:${videoId}`, '1', 30 * 24 * 60 * 60)
            await this.redis.del(`yt:chat_last:${videoId}`)
            this.logger.log(`YouTube: video ${videoId} marcado como listo (live terminado)`)
          }
        }
      }

      // 3. Para cada video, buscar comentarios de usuarios registrados
      if (ytUserMap.size > 0) {
        for (const videoId of videoIds) {
          await this.scanVideoComments(videoId, ytUserMap)
        }
      }

    } catch (err) {
      this.logger.error(`scanNewComments error: ${err}`)
    }
  }

  private async scanVideoComments(
    videoId: string,
    ytUserMap: Map<string, { userId: string; discordId: string; connectedAt: string }>
  ) {
    try {
      const res = await fetch(
        `${this.apiBase}/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${this.apiKey}`
      )
      const data = await res.json()

      for (const item of data.items ?? []) {
        const comment     = item.snippet.topLevelComment.snippet
        const authorId    = comment.authorChannelId?.value
        const commentId   = item.id
        const commentText = comment.textDisplay
        const commentedAt = comment.publishedAt ?? ''

        if (!authorId || !ytUserMap.has(authorId)) continue

        const { userId, discordId, connectedAt } = ytUserMap.get(authorId)!

        if (commentedAt && commentedAt < connectedAt) continue

        const { data: existing } = await this.supabase.db
          .from('xp_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_type', 'YOUTUBE_COMMENT')
          .eq('external_ref', commentId)
          .single()

        if (existing) continue

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

        const isFirstComment = await this.redis.setNX(`yt:first_comment:${videoId}`, '1', 30 * 24 * 60 * 60)
        if (isFirstComment) {
          try {
            await this.supabase.db
              .from('notifications')
              .insert({
                user_id: userId,
                type:    'FIRST_COMMENTER',
                title:   'Primero en comentar!',
                message: `Fuiste el primero en comentar en un video nuevo del canal. +100 XP y +50 SC!`,
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

  // ── Parsear duracion ISO 8601 a segundos ─────────────────
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
      await this.supabase.db
        .from('user_social_links')
        .upsert({
          user_id:     userId,
          platform:    'YOUTUBE',
          external_id: ytChannelId,
          username:    ytChannelId,
          is_verified: true,
        }, { onConflict: 'user_id,platform' })

      await this.rewardSubscription(userId, discordId, accessToken)

    } catch (err) {
      this.logger.error(`onUserConnected error: ${err}`)
    }
  }
}
