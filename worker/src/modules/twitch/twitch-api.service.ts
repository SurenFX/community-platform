import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
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

@Injectable()
export class TwitchApiService {
  private readonly logger = new Logger(TwitchApiService.name)
  private appToken: string | null = null
  private tokenExpiry: number = 0

  // Estado en memoria para detectar transición offline → online
  private wasLive = false

  constructor(
    private config:      ConfigService,
    private discordBot:  DiscordBotService,
    private telegram:    TelegramService,
    private redis:       RedisService,
  ) {}

  private get clientId(): string {
    return this.config.get<string>('TWITCH_CLIENT_ID') ?? ''
  }

  private get clientSecret(): string {
    return this.config.get<string>('TWITCH_CLIENT_SECRET') ?? ''
  }

  private get channel(): string {
    return this.config.get<string>('TWITCH_CHANNEL') ?? ''
  }

  // Obtener app access token (client credentials)
  private async getAppToken(): Promise<string> {
    if (this.appToken && Date.now() < this.tokenExpiry) {
      return this.appToken
    }

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        grant_type:    'client_credentials',
      }),
    })

    const data = await res.json()
    this.appToken    = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

    return this.appToken!
  }

  // Verificar si el streamer está en vivo
  async getStreamInfo(): Promise<StreamInfo> {
    try {
      const token = await this.getAppToken()

      const res = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${this.channel}`,
        {
          headers: {
            'Client-Id':     this.clientId,
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      const data = await res.json()
      const stream = data.data?.[0]

      if (!stream) {
        return { isLive: false, title: '', game: '', viewers: 0, startedAt: null }
      }

      return {
        isLive:    true,
        title:     stream.title,
        game:      stream.game_name,
        viewers:   stream.viewer_count,
        startedAt: stream.started_at,
      }
    } catch (err) {
      this.logger.warn(`getStreamInfo error: ${err}`)
      return { isLive: false, title: '', game: '', viewers: 0, startedAt: null }
    }
  }

  // Obtener el ID del canal del streamer
  async getChannelId(): Promise<string | null> {
    try {
      const token = await this.getAppToken()

      const res = await fetch(
        `https://api.twitch.tv/helix/users?login=${this.channel}`,
        {
          headers: {
            'Client-Id':     this.clientId,
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      const data = await res.json()
      return data.data?.[0]?.id ?? null
    } catch (err) {
      this.logger.warn(`getChannelId error: ${err}`)
      return null
    }
  }

  // ── Detección de stream en vivo — cada 3 minutos ──────────
  @Cron('*/3 * * * *')
  async checkStreamLive() {
    const channelId = this.config.get<string>('DISCORD_TWITCH_CHANNEL_ID')
    if (!channelId || !this.channel || !this.clientId) return

    const stream = await this.getStreamInfo()

    if (stream.isLive && !this.wasLive) {
      this.logger.log(`🔴 Stream en vivo detectado: ${stream.title}`)

      // Usar Redis para que solo UNA máquina anuncie (anti-duplicado)
      // TTL de 2 horas — si el stream dura más, no re-anuncia
      const isFirst = await this.redis.setNX(
        `twitch:live:${this.channel}`,
        '1',
        2 * 60 * 60
      )

      if (isFirst) {
        const embed = new EmbedBuilder()
          .setColor(0x9146FF)
          .setTitle(`🔴 ¡${this.channel} está en vivo!`)
          .setDescription(stream.title)
          .addFields(
            { name: '🎮 Juego',   value: stream.game || 'Sin categoría', inline: true },
            { name: '👥 Viewers', value: String(stream.viewers),          inline: true },
          )
          .setURL(`https://twitch.tv/${this.channel}`)
          .setTimestamp()

        await this.discordBot.announce(channelId, embed, '@everyone')
        await this.telegram.announce(
          `🔴 <b>¡${this.channel} está en vivo!</b>\n\n` +
          `🎮 ${stream.game || 'Sin categoría'} · 👥 ${stream.viewers} viewers\n` +
          `📺 ${stream.title}\n\n` +
          `<a href="https://twitch.tv/${this.channel}">¡Unite al stream!</a>`,
          'TELEGRAM_TWITCH_THREAD_ID'
        )
        this.logger.log(`🔴 Anuncio enviado a Discord y Telegram`)
      }
    }

    // Limpiar clave de Redis cuando el stream termina
    if (!stream.isLive && this.wasLive) {
      await this.redis.del(`twitch:live:${this.channel}`)
    }

    this.wasLive = stream.isLive
  }
}
