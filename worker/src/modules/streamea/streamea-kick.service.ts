import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

const KICK_API_BASE  = 'https://api.kick.com/public/v1'
const KICK_OAUTH_URL = 'https://id.kick.com/oauth/token'

const REQUIRED_EVENTS = [
  'chat.message.sent',
  'channel.followed',
  'channel.subscription.new',
  'channel.subscription.renewal',
]

export interface Tenant {
  id:           string   // st_streamers.id
  displayName:  string
  kickSlug:     string
  broadcasterId: string  // kick user_id numerico
}

/**
 * Capa multi-tenant de Streamea sobre la API de Kick.
 *
 * Diferencia clave con el modulo `kick` (del hub): aca NO hay un canal fijo en
 * env vars. La lista de canales sale de `st_streamers`, y todo (suscripciones,
 * envio de chat) se hace por tenant.
 *
 * El bot que habla en los chats es uno solo para toda la plataforma
 * (cuenta streameabot); su token vive en `kick_bot_tokens`.
 */
@Injectable()
export class StreameaKickService implements OnModuleInit {
  private readonly logger = new Logger(StreameaKickService.name)

  private appToken: string | null = null
  private appTokenExpiry = 0

  // broadcaster_user_id -> Tenant
  private tenants = new Map<string, Tenant>()

  constructor(
    private config:   ConfigService,
    private supabase: SupabaseService,
  ) {}

  async onModuleInit() {
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('Streamea: faltan KICK_CLIENT_ID/SECRET -- multi-tenant desactivado')
      return
    }
    // Delay para que Supabase termine de inicializar
    setTimeout(() => this.syncTenants().catch(err =>
      this.logger.warn(`sync inicial fallo: ${err}`)), 4000)
  }

  private get clientId(): string {
    return this.config.get<string>('KICK_CLIENT_ID') ?? ''
  }

  private get clientSecret(): string {
    return this.config.get<string>('KICK_CLIENT_SECRET') ?? ''
  }

  getTenant(broadcasterId: string | number | undefined): Tenant | null {
    if (broadcasterId == null) return null
    return this.tenants.get(String(broadcasterId)) ?? null
  }

  /** Refresca la lista de tenants y asegura las suscripciones de cada uno. */
  @Cron('*/10 * * * *')
  async syncTenants(): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('st_streamers')
      .select('id, display_name, kick_slug, kick_user_id')
      .eq('is_active', true)
      .not('kick_user_id', 'is', null)

    if (error) {
      this.logger.warn(`syncTenants: ${error.message}`)
      return
    }

    const rows = (data ?? []) as any[]
    this.tenants.clear()
    for (const row of rows) {
      this.tenants.set(String(row.kick_user_id), {
        id:            row.id,
        displayName:   row.display_name,
        kickSlug:      row.kick_slug ?? '',
        broadcasterId: String(row.kick_user_id),
      })
    }

    if (rows.length === 0) {
      this.logger.log('Streamea: no hay streamers con Kick conectado todavia')
      return
    }

    this.logger.log(`Streamea: ${rows.length} streamer(s) con Kick — verificando suscripciones`)
    await this.ensureSubscriptions()
  }

  private async getAppToken(): Promise<string | null> {
    if (this.appToken && Date.now() < this.appTokenExpiry) return this.appToken
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

  /** Crea las suscripciones de webhook que falten, para cada tenant. */
  private async ensureSubscriptions(): Promise<void> {
    const token = await this.getAppToken()
    if (!token) return

    // Suscripciones que ya tiene la app (todas, de todos los canales)
    const existing = new Map<string, Set<string>>()
    try {
      const res = await fetch(`${KICK_API_BASE}/events/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        for (const sub of (json?.data ?? []) as any[]) {
          const key = String(sub.broadcaster_user_id)
          if (!existing.has(key)) existing.set(key, new Set())
          existing.get(key)!.add(sub.event)
        }
      }
    } catch (err) {
      this.logger.warn(`listar suscripciones fallo: ${err}`)
    }

    for (const tenant of this.tenants.values()) {
      const have    = existing.get(tenant.broadcasterId) ?? new Set<string>()
      const missing = REQUIRED_EVENTS.filter(e => !have.has(e))
      if (missing.length === 0) continue

      try {
        const res = await fetch(`${KICK_API_BASE}/events/subscriptions`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${token}`,
          },
          body: JSON.stringify({
            broadcaster_user_id: Number(tenant.broadcasterId),
            method: 'webhook',
            events: missing.map(name => ({ name, version: 1 })),
          }),
        })
        if (res.ok) {
          this.logger.log(`Suscripciones creadas para ${tenant.displayName}: ${missing.join(', ')}`)
        } else {
          this.logger.warn(`Suscripcion fallo para ${tenant.displayName}: ${res.status} ${await res.text()}`)
        }
      } catch (err) {
        this.logger.warn(`Suscripcion error para ${tenant.displayName}: ${err}`)
      }
    }
  }

  /** Token del bot global (streameabot), con refresh automatico. */
  private async getBotToken(): Promise<string | null> {
    try {
      const { data } = await this.supabase.db
        .from('kick_bot_tokens')
        .select('*')
        .eq('id', 1)
        .single()

      if (!data) {
        this.logger.warn('getBotToken: no hay token del bot cargado')
        return null
      }

      const row       = data as any
      const expiresAt = new Date(row.expires_at).getTime()
      if (Date.now() < expiresAt - 5 * 60 * 1000) return row.access_token

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
        this.logger.warn(`getBotToken refresh failed: ${res.status} — hay que rehacer /kick/bot-auth`)
        return row.access_token
      }

      const json = await res.json()
      await this.supabase.db
        .from('kick_bot_tokens')
        .update({
          access_token:  json.access_token,
          refresh_token: json.refresh_token ?? row.refresh_token,
          expires_at:    new Date(Date.now() + json.expires_in * 1000).toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq('id', 1)

      this.logger.log('Token del bot refrescado')
      return json.access_token
    } catch (err) {
      this.logger.warn(`getBotToken error: ${err}`)
      return null
    }
  }

  /** Manda un mensaje al chat de un canal concreto, como el bot de la plataforma. */
  async sendChat(broadcasterId: string, message: string): Promise<boolean> {
    const token = await this.getBotToken()
    if (!token) return false

    try {
      const res = await fetch(`${KICK_API_BASE}/chat`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          broadcaster_user_id: Number(broadcasterId),
          content: message.slice(0, 500),
          type: 'bot',
        }),
      })

      if (res.ok) return true

      // Si la cuenta no esta registrada como bot del canal, Kick rechaza type:'bot'
      const body = await res.text()
      this.logger.warn(`sendChat(bot) fallo: ${res.status} ${body} — reintentando como user`)

      const retry = await fetch(`${KICK_API_BASE}/chat`, {
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

      if (!retry.ok) {
        this.logger.warn(`sendChat(user) fallo: ${retry.status} ${await retry.text()}`)
        return false
      }
      return true
    } catch (err) {
      this.logger.warn(`sendChat error: ${err}`)
      return false
    }
  }
}
