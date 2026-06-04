import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'
import { TwitchApiService } from './twitch-api.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import * as net from 'net'

@Injectable()
export class TwitchIrcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwitchIrcService.name)
  private client: net.Socket | null = null
  private isLive = false
  private firstGreeterAwarded = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private activeViewers = new Map<string, number>()

  constructor(
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private reputation: ReputationService,
    private twitchApi:  TwitchApiService,
    private redis:      RedisService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TWITCH_BOT_TOKEN')
    if (!token) {
      this.logger.warn('TWITCH_BOT_TOKEN no configurado — bot IRC desactivado')
      return
    }
    await this.connect()
  }

  onModuleDestroy() {
    this.disconnect()
  }

  private async connect() {
    const token    = this.config.get<string>('TWITCH_BOT_TOKEN') ?? ''
    const username = this.config.get<string>('TWITCH_BOT_USERNAME') ?? ''
    const channel  = this.config.get<string>('TWITCH_CHANNEL') ?? ''

    this.client = new net.Socket()

    this.client.connect(6667, 'irc.chat.twitch.tv', () => {
      this.send(`PASS ${token}`)
      this.send(`NICK ${username}`)
      this.send(`JOIN #${channel}`)
      this.send('CAP REQ :twitch.tv/commands twitch.tv/tags')

      this.pingTimer = setInterval(() => {
        this.send('PING :tmi.twitch.tv')
      }, 4 * 60 * 1000)

      this.logger.log(`✓ Twitch IRC bot conectado al canal #${channel}`)
    })

    this.client.on('data', (data) => {
      const lines = data.toString().split('\r\n').filter(Boolean)
      lines.forEach(line => this.handleLine(line))
    })

    this.client.on('error', (err) => {
      this.logger.error(`IRC error: ${err.message}`)
    })

    this.client.on('close', () => {
      this.logger.warn('IRC desconectado — reconectando en 30s...')
      if (this.pingTimer) clearInterval(this.pingTimer)
      this.reconnectTimer = setTimeout(() => this.connect(), 30000)
    })
  }

  private disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.pingTimer)      clearInterval(this.pingTimer)
    this.client?.destroy()
  }

  private send(message: string) {
    this.client?.write(`${message}\r\n`)
  }

  // Enviar mensaje al chat del canal
  sendChat(message: string) {
    const channel = this.config.get<string>('TWITCH_CHANNEL') ?? ''
    this.send(`PRIVMSG #${channel} :${message}`)
    this.logger.log(`Chat → ${message}`)
  }

  private async handleLine(line: string) {
    if (line.startsWith('PING')) {
      this.send('PONG :tmi.twitch.tv')
      return
    }

    if (!line.includes('PRIVMSG')) return

    const usernameMatch = line.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG/)
    const messageMatch  = line.match(/PRIVMSG #\w+ :(.+)/)
    if (!usernameMatch || !messageMatch) return

    const twitchUsername = usernameMatch[1].toLowerCase()
    const messageContent = messageMatch[1].trim()

    const botUsername = this.config.get<string>('TWITCH_BOT_USERNAME')?.toLowerCase()
    if (twitchUsername === botUsername) return

    await this.checkRaffleKeyword(twitchUsername, messageContent)

    if (!this.isLive) return

    const { data: socialLink } = await this.supabase.db
      .from('user_social_links')
      .select('user_id, profiles!inner(discord_id)')
      .eq('platform', 'TWITCH')
      .ilike('username', twitchUsername)
      .single()

    if (!socialLink) return

    const discordId = (socialLink as any).profiles?.discord_id
    if (!discordId) return

    await this.reputation.processXpEvent({
      discordId,
      eventType:   'TWITCH_CHAT_MESSAGE',
      platform:    'TWITCH',
      externalRef: `twitch_chat_${twitchUsername}_${Date.now()}`,
      metadata: { twitch_username: twitchUsername, content: messageContent.slice(0, 200) },
    })

    // ── Primero en saludar en el stream ──────────────────────────────────
    const channel = this.config.get<string>('TWITCH_CHANNEL') ?? 'stream'
    const isFirstGreeter = await this.redis.setNX(`twitch:first_greeter:${channel}`, '1', 12 * 60 * 60)
    if (isFirstGreeter) {
      try {
        await this.supabase.db
          .from('notifications')
          .insert({
            user_id: socialLink.user_id,
            type:    'FIRST_GREETER',
            title:   '🎉 ¡Primero en saludar!',
            message: `Fuiste el primero en escribir en el chat del stream. ¡+100 XP y 3 tickets!`,
          })

        await this.supabase.db.rpc('award_xp', {
          p_user_id:    socialLink.user_id,
          p_event_type: 'TWITCH_CHAT_MESSAGE',
          p_platform:   'TWITCH',
          p_xp:         100,
          p_base_xp:    100,
          p_multiplier: 1.0,
          p_quality:    1.0,
          p_streak:     0,
          p_ref:        `first_greeter_${Date.now()}`,
        })

        const { data: rep } = await this.supabase.db
          .from('user_reputation')
          .select('raffle_tickets')
          .eq('user_id', socialLink.user_id)
          .single()

        await this.supabase.db
          .from('user_reputation')
          .update({ raffle_tickets: ((rep as any)?.raffle_tickets ?? 0) + 3 })
          .eq('user_id', socialLink.user_id)

        // No spamear el chat — la notificación llega por la plataforma
        this.logger.log(`First greeter: ${twitchUsername}`)
      } catch (err) {
        this.logger.warn(`First greeter error: ${err}`)
      }
    }

    this.activeViewers.set(twitchUsername, Date.now())
  }

  private async checkRaffleKeyword(twitchUsername: string, message: string) {
    try {
      const { data: raffle } = await this.supabase.db
        .from('twitch_raffles')
        .select('id, keyword')
        .eq('status', 'active')
        .single()

      if (!raffle) return
      if (message.toLowerCase().trim() !== raffle.keyword.toLowerCase().trim()) return

      const { data: socialLink } = await this.supabase.db
        .from('user_social_links')
        .select('user_id')
        .eq('platform', 'TWITCH')
        .ilike('username', twitchUsername)
        .single()

      // Cualquier viewer puede participar — user_id es null si no está registrado
      const { error } = await this.supabase.db
        .from('twitch_raffle_entries')
        .insert({
          raffle_id:       raffle.id,
          user_id:         socialLink?.user_id ?? null,
          twitch_username: twitchUsername,
        })

      if (!error) {
        this.logger.log(`Raffle entry: ${twitchUsername} → ${raffle.id}`)
      }
    } catch (err) {}
  }

  // ── Llamados desde el frontend via endpoint ────────────
  async announceRaffleStart(keyword: string) {
    this.sendChat(`🎉 ¡Sorteo! Escribí "${keyword}" en el chat para participar.`)
  }

  async announceRaffleWinner(winner: string) {
    this.sendChat(`🏆 ¡@${winner} es el ganador del sorteo! ¡Felicitaciones! 🎉`)
  }

  @Cron('*/2 * * * *')
  async checkStreamStatus() {
    try {
      const info = await this.twitchApi.getStreamInfo()

      if (info.isLive && !this.isLive) {
        this.logger.log(`Stream iniciado: ${info.title}`)
        this.isLive = true
        this.activeViewers.clear()
        // Limpiar el flag de primer saludador para este nuevo stream
        const ch = this.config.get<string>('TWITCH_CHANNEL') ?? 'stream'
        await this.redis.del(`twitch:first_greeter:${ch}`)

        await this.supabase.db.from('stream_sessions').insert({ title: info.title, game: info.game })
        await this.supabase.db.from('platform_config').upsert([
          { key: 'stream_is_live',    value: 'true'           },
          { key: 'stream_title',      value: info.title        },
          { key: 'stream_game',       value: info.game         },
          { key: 'stream_started_at', value: info.startedAt ?? '' },
        ])

      } else if (!info.isLive && this.isLive) {
        this.logger.log('Stream terminado')
        this.isLive = false
        this.activeViewers.clear()

        await this.supabase.db.from('platform_config').upsert([
          { key: 'stream_is_live', value: 'false' },
          { key: 'stream_title',   value: ''       },
        ])
      }
    } catch (err) {
      this.logger.warn(`checkStreamStatus error: ${err}`)
    }
  }

  @Cron('*/10 * * * *')
  async rewardWatchTime() {
    if (!this.isLive) return

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000
    const active = [...this.activeViewers.entries()]
      .filter(([, t]) => t >= tenMinutesAgo)
      .map(([u]) => u)

    for (const twitchUsername of active) {
      const { data: socialLink } = await this.supabase.db
        .from('user_social_links')
        .select('user_id, profiles!inner(discord_id)')
        .eq('platform', 'TWITCH')
        .ilike('username', twitchUsername)
        .single()

      if (!socialLink) continue
      const discordId = (socialLink as any).profiles?.discord_id
      if (!discordId) continue

      await this.reputation.processXpEvent({
        discordId,
        eventType:   'TWITCH_WATCH_TIME',
        platform:    'TWITCH',
        externalRef: `watch_${twitchUsername}_${Math.floor(Date.now() / 600000)}`,
        metadata:    { twitch_username: twitchUsername },
      })
    }
  }
}
