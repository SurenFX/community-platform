import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

interface StreamInfo {
  isLive:    boolean
  title:     string
  game:      string
  viewers:   number
  startedAt: string | null
}

const KICK_OAUTH_URL = 'https://id.kick.com/oauth/token'
const KICK_API_BASE  = 'https://api.kick.com/public/v1'

@Injectable()
export class KickApiService implements OnModuleInit {
  private readonly logger = new Logger(KickApiService.name)

  private appToken: string | null = null
  private appTokenExpiry = 0
  private broadcasterId: string | null = null

  // Estado en memoria para detectar transicion offline -> online (streamer principal)
  private wasLive = false

  // Cache de broadcaster_user_id y estado live para streamers amigos (Kick)
  private friendBroadcasterIds = new Map<string, string>()
  private friendWasLive        = new Map<string, boolean>()

  // Cache de app token de Twitch
  private twitchAppToken: string | null = null
  private twitchAppTokenExpiry = 0

  constructor(
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private discordBot: DiscordBotService,
    private telegram:   TelegramService,
    private redis:      RedisService,
  ) {}

  async onModuleInit() {
    if (!this.clientId || !this.channelSlug) {
      this.logger.warn('KICK_CLIENT_ID / KICK_CHANNEL_SLUG no configurados -- integracion de Kick desactivada')
      return
    }
    await this.ensureChatSubscription()
  }

  private get clientId(): string {
    return this.config.get<string>('KICK_CLIENT_ID') ?? ''
  }

  private get clientSecret(): string {
    return this.config.get<string>('KICK_CLIENT_SECRET') ?? ''
  }

  private get channelSlug(): string {
    return this.config.get<string>('KICK_CHANNEL_SLUG') ?? ''
  }

  private async getAppToken(): Promise<string | null> {
    if (this.appToken && Date.now() < this.appTokenExpiry) return this.appToken
    if (!this.clientId || !this.clientSecret) return null

    try {
      const res = await fetch(KICK_OAUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     this.clientId,
          client_secret: this.clientSecret,
          grant_type:    'client_credentials',
        }),
      })

      if (!res.ok) {
        this.logger.warn(`getAppToken failed: ${res.status}`)
        return null
      }

      const data = await res.json()
      this.appToken       = data.access_token
      this.appTokenExpiry = Date.now() + (data.expires_in - 300) * 1000
      return this.appToken
    } catch (err) {
      this.logger.warn(`getAppToken error: ${err}`)
      return null
    }
  }

  async getBotToken(): Promise<string | null> {
    try {
      const { data } = await this.supabase.db
        .from('kick_bot_tokens')
        .select('*')
        .eq('id', 1)
        .single()

      if (!data) {
        this.logger.warn('getBotToken: no hay fila en kick_bot_tokens')
        return null
      }

      const row = data as any
      const expiresAt = new Date(row.expires_at).getTime()

      if (Date.now() < expiresAt - 5 * 60 * 1000) {
        return row.access_token
      }

      if (!this.clientId || !this.clientSecret) {
        this.logger.warn('getBotToken: faltan KICK_CLIENT_ID/KICK_CLIENT_SECRET')
        return row.access_token
      }

      const res = await fetch(KICK_OAUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: row.refresh_token,
          client_id:     this.clientId,
          client_secret: this.clientSecret,
        }),
      })

      if (!res.ok) {
        this.logger.warn(`getBotToken refresh failed: ${res.status} ${await res.text()}`)
        return row.access_token
      }

      const json = await res.json()
      const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()

      await this.supabase.db
        .from('kick_bot_tokens')
        .update({
          access_token:  json.access_token,
          refresh_token: json.refresh_token ?? row.refresh_token,
          expires_at:    newExpiresAt,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', 1)

      this.logger.log('Bot token de Kick refrescado')
      return json.access_token
    } catch (err) {
      this.logger.warn(`getBotToken error: ${err}`)
      return null
    }
  }

  async getBroadcasterId(): Promise<string | null> {
    if (this.broadcasterId) return this.broadcasterId
    if (!this.channelSlug) return null

    try {
      const token = await this.getAppToken()
      if (!token) return null

      const res = await fetch(`${KICK_API_BASE}/channels?slug=${encodeURIComponent(this.channelSlug)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        this.logger.warn(`getBroadcasterId failed: ${res.status}`)
        return null
      }

      const data = await res.json()
      const id = data?.data?.[0]?.broadcaster_user_id
      this.broadcasterId = id != null ? String(id) : null
      return this.broadcasterId
    } catch (err) {
      this.logger.warn(`getBroadcasterId error: ${err}`)
      return null
    }
  }

  async getStreamInfo(): Promise<StreamInfo> {
    const empty: StreamInfo = { isLive: false, title: '', game: '', viewers: 0, startedAt: null }

    try {
      const token = await this.getAppToken()
      const broadcasterId = await this.getBroadcasterId()
      if (!token || !broadcasterId) return empty

      const res = await fetch(`${KICK_API_BASE}/livestreams?broadcaster_user_id=${broadcasterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) return empty

      const data = await res.json()
      const stream = data?.data?.[0]
      if (!stream) return empty

      return {
        isLive:    true,
        title:     stream.stream_title ?? '',
        game:      stream.category?.name ?? '',
        viewers:   stream.viewer_count ?? 0,
        startedAt: stream.started_at ?? null,
      }
    } catch (err) {
      this.logger.warn(`getStreamInfo error: ${err}`)
      return empty
    }
  }

  async sendChat(message: string): Promise<void> {
    try {
      const token = await this.getBotToken()
      if (!token) {
        this.logger.warn('sendChat: sin bot token')
        return
      }

      const broadcasterId = await this.getBroadcasterId()
      if (!broadcasterId) {
        this.logger.warn('sendChat: no se pudo resolver broadcaster_user_id')
        return
      }

      const res = await fetch(`${KICK_API_BASE}/chat`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          broadcaster_user_id: Number(broadcasterId),
          content: message.slice(0, 500),
          type: 'user',
        }),
      })

      if (!res.ok) {
        this.logger.warn(`sendChat failed: ${res.status} ${await res.text()}`)
      } else {
        this.logger.log(`Chat -> ${message}`)
      }
    } catch (err) {
      this.logger.warn(`sendChat error: ${err}`)
    }
  }

  private readonly REQUIRED_EVENTS = [
    'chat.message.sent',
    'channel.followed',
    'channel.subscription.new',
    'channel.subscription.renewal',
  ]

  async ensureChatSubscription(): Promise<void> {
    try {
      const token = await this.getAppToken()
      if (!token) return

      const broadcasterId = await this.getBroadcasterId()
      if (!broadcasterId) return

      const existingRes = await fetch(`${KICK_API_BASE}/events/subscriptions?broadcaster_user_id=${broadcasterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      let already: string[] = []
      if (existingRes.ok) {
        const existing = await existingRes.json()
        already = (existing?.data ?? []).map((s: any) => s.event)
      }

      const missing = this.REQUIRED_EVENTS.filter(e => !already.includes(e))
      if (missing.length === 0) return

      const res = await fetch(`${KICK_API_BASE}/events/subscriptions`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          broadcaster_user_id: Number(broadcasterId),
          events:  missing.map(name => ({ name, version: 1 })),
          method:  'webhook',
        }),
      })

      if (res.ok) {
        this.logger.log(`Suscripcion a eventos de Kick creada: ${missing.join(', ')}`)
      } else {
        this.logger.warn(`ensureChatSubscription failed: ${res.status} ${await res.text()}`)
      }
    } catch (err) {
      this.logger.warn(`ensureChatSubscription error: ${err}`)
    }
  }

  // -- Twitch Helix API (para amigos streamers) --

  private async getTwitchAppToken(): Promise<string | null> {
    if (this.twitchAppToken && Date.now() < this.twitchAppTokenExpiry) return this.twitchAppToken
    const clientId     = this.config.get<string>('TWITCH_CLIENT_ID')
    const clientSecret = this.config.get<string>('TWITCH_CLIENT_SECRET')
    if (!clientId || !clientSecret) return null
    try {
      const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
        { method: 'POST' },
      )
      if (!res.ok) return null
      const data = await res.json()
      this.twitchAppToken       = data.access_token
      this.twitchAppTokenExpiry = Date.now() + (data.expires_in - 300) * 1000
      return this.twitchAppToken
    } catch (err) {
      this.logger.warn(`getTwitchAppToken error: ${err}`)
      return null
    }
  }

  private async getTwitchStreamInfo(login: string): Promise<StreamInfo> {
    const empty: StreamInfo = { isLive: false, title: '', game: '', viewers: 0, startedAt: null }
    try {
      const token    = await this.getTwitchAppToken()
      const clientId = this.config.get<string>('TWITCH_CLIENT_ID')
      if (!token || !clientId) return empty
      const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
        headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return empty
      const data   = await res.json()
      const stream = data?.data?.[0]
      if (!stream) return empty
      return {
        isLive:    true,
        title:     stream.title ?? '',
        game:      stream.game_name ?? '',
        viewers:   stream.viewer_count ?? 0,
        startedAt: stream.started_at ?? null,
      }
    } catch (err) {
      this.logger.warn(`getTwitchStreamInfo(${login}) error: ${err}`)
      return empty
    }
  }

  // -- Helpers para streamers amigos --

  private async getStreamInfoForSlug(slug: string): Promise<StreamInfo> {
    const empty: StreamInfo = { isLive: false, title: '', game: '', viewers: 0, startedAt: null }
    try {
      const token = await this.getAppToken()
      if (!token) return empty

      // Resolver broadcaster_user_id (cacheado en memoria por slug)
      let broadcasterId = this.friendBroadcasterIds.get(slug)
      if (!broadcasterId) {
        const res = await fetch(`${KICK_API_BASE}/channels?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return empty
        const data = await res.json()
        const id = data?.data?.[0]?.broadcaster_user_id
        if (!id) return empty
        broadcasterId = String(id)
        this.friendBroadcasterIds.set(slug, broadcasterId)
      }

      const res = await fetch(`${KICK_API_BASE}/livestreams?broadcaster_user_id=${broadcasterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return empty
      const data = await res.json()
      const stream = data?.data?.[0]
      if (!stream) return empty

      return {
        isLive:    true,
        title:     stream.stream_title ?? '',
        game:      stream.category?.name ?? '',
        viewers:   stream.viewer_count ?? 0,
        startedAt: stream.started_at ?? null,
      }
    } catch (err) {
      this.logger.warn(`getStreamInfoForSlug(${slug}) error: ${err}`)
      return empty
    }
  }

  // -- Chequeo de streamers amigos -- cada 5 minutos --
  @Cron('*/5 * * * *')
  async checkFriendStreamers() {
    const discordChannelId = this.config.get<string>('DISCORD_FRIENDS_CHANNEL_ID')
    if (!discordChannelId) return

    const { data: friends } = await this.supabase.db
      .from('friend_streamers')
      .select('name, kick_slug, twitch_login')
      .eq('is_active', true)

    if (!friends?.length) return

    for (const friend of friends as any[]) {
      const { name, kick_slug: kickSlug, twitch_login: twitchLogin } = friend

      // -- Kick --
      if (kickSlug && this.clientId) {
        const stream  = await this.getStreamInfoForSlug(kickSlug)
        const wasLive = this.friendWasLive.get(`kick:${kickSlug}`) ?? false

        if (stream.isLive && !wasLive) {
          const isFirst = await this.redis.setNX(`friend:live:${kickSlug}`, '1', 2 * 60 * 60)
          if (isFirst) {
            const embed = new EmbedBuilder()
              .setColor(0x53FC18)
              .setTitle(`🎮 ${name} está en vivo en Kick!`)
              .setDescription(stream.title || 'Stream en vivo')
              .addFields(
                { name: 'Categoría', value: stream.game || 'Sin categoría', inline: true },
                { name: 'Viewers',   value: String(stream.viewers),          inline: true },
              )
              .setURL(`https://kick.com/${kickSlug}`)
              .setFooter({ text: 'Amigo de la comunidad SalchiNeta' })
              .setTimestamp()
            await this.discordBot.announce(discordChannelId, embed, '@everyone')
            this.logger.log(`Anuncio de amigo "${name}" en Kick enviado`)
          }
        }
        if (!stream.isLive && wasLive) await this.redis.del(`friend:live:${kickSlug}`)
        this.friendWasLive.set(`kick:${kickSlug}`, stream.isLive)
      }

      // -- Twitch --
      if (twitchLogin) {
        const stream  = await this.getTwitchStreamInfo(twitchLogin)
        const wasLive = this.friendWasLive.get(`twitch:${twitchLogin}`) ?? false

        if (stream.isLive && !wasLive) {
          const isFirst = await this.redis.setNX(`friend:twitch:live:${twitchLogin}`, '1', 2 * 60 * 60)
          if (isFirst) {
            const embed = new EmbedBuilder()
              .setColor(0x9146FF)
              .setTitle(`🟣 ${name} está en vivo en Twitch!`)
              .setDescription(stream.title || 'Stream en vivo')
              .addFields(
                { name: 'Categoría', value: stream.game || 'Sin categoría', inline: true },
                { name: 'Viewers',   value: String(stream.viewers),          inline: true },
              )
              .setURL(`https://twitch.tv/${twitchLogin}`)
              .setFooter({ text: 'Amigo de la comunidad SalchiNeta' })
              .setTimestamp()
            await this.discordBot.announce(discordChannelId, embed, '@everyone')
            this.logger.log(`Anuncio de amigo "${name}" en Twitch enviado`)
          }
        }
        if (!stream.isLive && wasLive) await this.redis.del(`friend:twitch:live:${twitchLogin}`)
        this.friendWasLive.set(`twitch:${twitchLogin}`, stream.isLive)
      }
    }
  }

  // -- Deteccion de Kick en vivo -- cada 3 minutos --
  @Cron('*/3 * * * *')
  async checkStreamLive() {
    const discordChannelId = this.config.get<string>('DISCORD_TWITCH_CHANNEL_ID')
    if (!discordChannelId || !this.channelSlug || !this.clientId) return

    const stream = await this.getStreamInfo()

    // Transicion: offline -> online
    if (stream.isLive && !this.wasLive) {
      this.logger.log(`Kick en vivo detectado: ${stream.title}`)

      const isFirst = await this.redis.setNX(
        `kick:live:${this.channelSlug}`,
        '1',
        2 * 60 * 60,
      )

      if (isFirst) {
        const embed = new EmbedBuilder()
          .setColor(0x53FC18)
          .setTitle(`LIVE en Kick: ${this.channelSlug} esta en vivo!`)
          .setDescription(stream.title || 'Stream en vivo')
          .addFields(
            { name: 'Categoria', value: stream.game || 'Sin categoria', inline: true },
            { name: 'Viewers',   value: String(stream.viewers),          inline: true },
          )
          .setURL(`https://kick.com/${this.channelSlug}`)
          .setTimestamp()

        await this.discordBot.announce(discordChannelId, embed, '@everyone')
        await this.telegram.announce(
          `LIVE en Kick: <b>${this.channelSlug} esta en vivo!</b>\n\n` +
          `${stream.game || 'Sin categoria'} - ${stream.viewers} viewers\n` +
          `${stream.title}\n\n` +
          `<a href="https://kick.com/${this.channelSlug}">Unite al stream!</a>`,
          'TELEGRAM_TWITCH_THREAD_ID',
        )
        this.logger.log('Anuncio de Kick enviado a Discord y Telegram')
      }
    }

    // Transicion: online -> offline
    if (!stream.isLive && this.wasLive) {
      this.logger.log('Stream de Kick termino')
      await this.redis.del(`kick:live:${this.channelSlug}`)
    }

    // Mantener clave de presencia en Redis para que TwitchIrcService
    // pueda detectar si Kick esta en vivo (TTL 5 min, tick cada 3 min)
    if (stream.isLive) {
      await this.redis.set('kick:stream_active', '1', 5 * 60)
    }

    this.wasLive = stream.isLive
  }
}
