import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

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

  constructor(private config: ConfigService) {}

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
    this.appToken   = data.access_token
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
}
