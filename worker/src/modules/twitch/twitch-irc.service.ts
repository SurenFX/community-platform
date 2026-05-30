import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'
import { TwitchApiService } from './twitch-api.service'
import * as net from 'net'

@Injectable()
export class TwitchIrcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwitchIrcService.name)
  private client: net.Socket | null = null
  private isLive = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null

  // Trackear usuarios activos en el chat durante el stream
  // Map<twitchUsername, lastMessageTimestamp>
  private activeViewers = new Map<string, number>()

  constructor(
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private reputation: ReputationService,
    private twitchApi:  TwitchApiService,
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
      this.logger.log('Conectando al IRC de Twitch...')
      this.send(`PASS ${token}`)
      this.send(`NICK ${username}`)
      this.send(`JOIN #${channel}`)
      this.send('CAP REQ :twitch.tv/commands twitch.tv/tags')

      // Ping cada 4 minutos para mantener la conexión viva
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

  private async handleLine(line: string) {
    // Responder al PING del servidor
    if (line.startsWith('PING')) {
      this.send('PONG :tmi.twitch.tv')
      return
    }

    // Parsear mensajes PRIVMSG (mensajes del chat)
    // Formato: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :mensaje
    if (!line.includes('PRIVMSG')) return
    if (!this.isLive) return  // solo dar XP cuando el streamer está en vivo

    const usernameMatch = line.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG/)
    const messageMatch  = line.match(/PRIVMSG #\w+ :(.+)/)

    if (!usernameMatch || !messageMatch) return

    const twitchUsername = usernameMatch[1].toLowerCase()
    const messageContent = messageMatch[1]

    // Ignorar mensajes del bot mismo
    const botUsername = this.config.get<string>('TWITCH_BOT_USERNAME')?.toLowerCase()
    if (twitchUsername === botUsername) return

    // Buscar usuario registrado en la plataforma por su Twitch username
    const { data: socialLink } = await this.supabase.db
      .from('user_social_links')
      .select('user_id, profiles!inner(discord_id)')
      .eq('platform', 'TWITCH')
      .ilike('username', twitchUsername)
      .single()

    if (!socialLink) return // usuario no registrado en la plataforma

    const discordId = (socialLink as any).profiles?.discord_id
    if (!discordId) return

    // XP por mensaje en chat durante el stream
    await this.reputation.processXpEvent({
      discordId,
      eventType:   'TWITCH_CHAT_MESSAGE',
      platform:    'TWITCH',
      externalRef: `twitch_chat_${Date.now()}`,
      metadata: {
        twitch_username: twitchUsername,
        content:         messageContent.slice(0, 200),
      },
    })

    // Trackear como viewer activo para el bloque de watch time
    this.activeViewers.set(twitchUsername, Date.now())
  }

  // ── Verificar si el stream está en vivo cada 2 minutos ──
  @Cron('*/2 * * * *')
  async checkStreamStatus() {
    try {
      const info = await this.twitchApi.getStreamInfo()

      if (info.isLive && !this.isLive) {
        this.logger.log(`Stream iniciado: ${info.title}`)
        this.isLive = true
        this.activeViewers.clear()

        // Registrar nueva sesión de stream en la DB
        await this.supabase.db
          .from('stream_sessions')
          .insert({
            title: info.title,
            game:  info.game,
          })

        // Actualizar config de la plataforma
        await this.supabase.db
          .from('platform_config')
          .upsert([
            { key: 'stream_is_live',    value: 'true' },
            { key: 'stream_title',      value: info.title },
            { key: 'stream_game',       value: info.game },
            { key: 'stream_started_at', value: info.startedAt ?? '' },
          ])

      } else if (!info.isLive && this.isLive) {
        this.logger.log('Stream terminado')
        this.isLive = false
        this.activeViewers.clear()

        await this.supabase.db
          .from('platform_config')
          .upsert([
            { key: 'stream_is_live', value: 'false' },
            { key: 'stream_title',   value: '' },
          ])
      }
    } catch (err) {
      this.logger.warn(`checkStreamStatus error: ${err}`)
    }
  }

  // ── Otorgar XP por watch time cada 10 minutos ──────────
  // Solo a viewers que hayan enviado al menos 1 mensaje en los últimos 10 min
  @Cron('*/10 * * * *')
  async rewardWatchTime() {
    if (!this.isLive) return

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000
    const activeInLastBlock = [...this.activeViewers.entries()]
      .filter(([, lastMsg]) => lastMsg >= tenMinutesAgo)
      .map(([username]) => username)

    if (!activeInLastBlock.length) return

    this.logger.log(`Rewarding watch time para ${activeInLastBlock.length} viewers`)

    for (const twitchUsername of activeInLastBlock) {
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
        externalRef: `watch_${twitchUsername}_${Date.now()}`,
        metadata:    { twitch_username: twitchUsername },
      })
    }
  }
}
