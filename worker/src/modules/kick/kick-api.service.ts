import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

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

  // App access token (client_credentials) -- endpoints publicos (canales, livestreams)
  private appToken: string | null = null
  private appTokenExpiry = 0

  // Cache del broadcaster_user_id resuelto a partir del slug del canal
  private broadcasterId: string | null = null

  constructor(
    private config:   ConfigService,
    private supabase: SupabaseService,
  ) {}

  async onModuleInit() {
    if (!this.clientId || !this.channelSlug) {
      this.logger.warn('KICK_CLIENT_ID / KICK_CHANNEL_SLUG no configurados -- integración de Kick desactivada')
      return
    }
    // Best-effort: si el bot ya tiene token, asegura la suscripción al webhook de chat.
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

  // ── App access token (client_credentials) ─────────────────────────────────
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

  // ── Bot user access token (authorization_code + refresh, persistido en Supabase) ──
  // Usado para enviar mensajes al chat y administrar la suscripcion al webhook.
  // La fila inicial (id=1) se carga a mano luego del flujo OAuth manual (ver guía de setup).
  async getBotToken(): Promise<string | null> {
    try {
      const { data } = await this.supabase.db
        .from('kick_bot_tokens')
        .select('*')
        .eq('id', 1)
        .single()

      if (!data) {
        this.logger.warn('getBotToken: no hay fila en kick_bot_tokens -- completar el setup de OAuth del bot')
        return null
      }

      const row = data as any
      const expiresAt = new Date(row.expires_at).getTime()

      // Margen de 5 minutos antes de refrescar
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

  // ── Resolver broadcaster_user_id a partir del slug del canal ──────────────
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

  // ── Estado del stream (live/offline) ───────────────────────────────────────
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

  // ── Enviar mensaje al chat como bot ────────────────────────────────────────
  async sendChat(message: string): Promise<void> {
    try {
      const token = await this.getBotToken()
      if (!token) {
        this.logger.warn('sendChat: sin bot token -- mensaje no enviado (configurá el bot de Kick)')
        return
      }

      const broadcasterId = await this.getBroadcasterId()
      if (!broadcasterId) {
        this.logger.warn('sendChat: no se pudo resolver broadcaster_user_id (KICK_CHANNEL_SLUG)')
        return
      }

      const res = await fetch(`${KICK_API_BASE}/chat`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({
          broadcaster_user_id: Number(broadcasterId),
          content: message.slice(0, 500),
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

  // ── Suscripcion al evento chat.message.sent (idempotente) ──────────────────
  // Se llama al iniciar el worker. Usa el App Access Token (no el del bot):
  // con un user access token, Kick ignora "broadcaster_user_id" y suscribe al
  // canal del propio token. Con un app access token, broadcaster_user_id es
  // obligatorio y permite suscribirse al canal de KICK_CHANNEL_SLUG sin
  // importar qué cuenta sea el bot.
  async ensureChatSubscription(): Promise<void> {
    try {
      const token = await this.getAppToken()
      if (!token) return

      const broadcasterId = await this.getBroadcasterId()
      if (!broadcasterId) return

      const existingRes = await fetch(`${KICK_API_BASE}/events/subscriptions?broadcaster_user_id=${broadcasterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (existingRes.ok) {
        const existing = await existingRes.json()
        const already = existing?.data?.some((s: any) => s.event === 'chat.message.sent')
        if (already) return
      }

      const res = await fetch(`${KICK_API_BASE}/events/subscriptions`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          broadcaster_user_id: Number(broadcasterId),
          events:  [{ name: 'chat.message.sent', version: 1 }],
          method:  'webhook',
        }),
      })

      if (res.ok) {
        this.logger.log('Suscripción a chat.message.sent (Kick) creada')
      } else {
        this.logger.warn(`ensureChatSubscription failed: ${res.status} ${await res.text()}`)
      }
    } catch (err) {
      this.logger.warn(`ensureChatSubscription error: ${err}`)
    }
  }
}
                          