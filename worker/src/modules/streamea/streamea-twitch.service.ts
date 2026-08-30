import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import * as net from 'net'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

const TWITCH_OAUTH_URL = 'https://id.twitch.tv/oauth2/token'
const HELIX_BASE       = 'https://api.twitch.tv/helix'

export interface TwitchTenant {
  id:          string   // st_streamers.id
  displayName: string
  login:       string   // canal de twitch, minusculas
  userId:      string | null
}

/**
 * Bot de Twitch de Streamea, multi-tenant.
 *
 * Se conecta al IRC de Twitch con la cuenta bot de la plataforma (token en
 * `st_bot_tokens`, alta via /setup/twitch-bot en la web) y joinea el canal de
 * cada streamer registrado en `st_streamers`.
 */
@Injectable()
export class StreameaTwitchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreameaTwitchService.name)

  private client: net.Socket | null = null
  private joined = new Set<string>()
  private pingTimer?: NodeJS.Timeout
  private reconnectTimer?: NodeJS.Timeout
  private stopped = false

  private botUsername: string | null = null

  // login del canal -> tenant
  private tenants = new Map<string, TwitchTenant>()
  // cooldowns de comandos: `${tenantId}:${cmd}` -> timestamp
  private cooldowns = new Map<string, number>()
  // cache de comandos por tenant
  private commandsCache = new Map<string, { at: number; map: Record<string, string> }>()

  constructor(
    private config:   ConfigService,
    private supabase: SupabaseService,
  ) {}

  async onModuleInit() {
    // Delay para que Supabase termine de inicializar
    setTimeout(() => this.start().catch(err =>
      this.logger.warn(`arranque fallo: ${err}`)), 5000)
  }

  onModuleDestroy() {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.pingTimer)      clearInterval(this.pingTimer)
    this.client?.destroy()
  }

  private async start() {
    await this.syncTenants()
    const token = await this.getBotToken()
    if (!token) {
      this.logger.warn('Streamea Twitch: sin token de bot — corré /setup/twitch-bot en la web')
      return
    }
    this.connect(token)
  }

  // --- Tenants ---

  @Cron('*/10 * * * *')
  async syncTenants(): Promise<void> {
    const { data, error } = await this.supabase.db
      .from('st_streamers')
      .select('id, display_name, twitch_login, twitch_user_id')
      .eq('is_active', true)
      .not('twitch_login', 'is', null)

    if (error) {
      this.logger.warn(`syncTenants: ${error.message}`)
      return
    }

    this.tenants.clear()
    for (const row of (data ?? []) as any[]) {
      const login = String(row.twitch_login).toLowerCase()
      this.tenants.set(login, {
        id:          row.id,
        displayName: row.display_name,
        login,
        userId:      row.twitch_user_id ?? null,
      })
    }

    // Joinear los canales nuevos si ya estamos conectados
    if (this.client && !this.client.destroyed) {
      for (const login of this.tenants.keys()) {
        if (!this.joined.has(login)) {
          this.send(`JOIN #${login}`)
          this.joined.add(login)
          this.logger.log(`IRC: joineado #${login}`)
        }
      }
    }
  }

  // --- Token del bot ---

  private async getBotToken(): Promise<string | null> {
    try {
      const { data } = await this.supabase.db
        .from('st_bot_tokens')
        .select('*')
        .eq('platform', 'TWITCH')
        .maybeSingle()

      if (!data) return null
      const row = data as any
      this.botUsername = row.bot_username ?? null

      const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
      if (Date.now() < expiresAt - 10 * 60 * 1000) return row.access_token
      if (!row.refresh_token) return row.access_token

      const res = await fetch(TWITCH_OAUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: row.refresh_token,
          client_id:     this.config.get<string>('TWITCH_CLIENT_ID')     ?? '',
          client_secret: this.config.get<string>('TWITCH_CLIENT_SECRET') ?? '',
        }),
      })

      if (!res.ok) {
        this.logger.warn(`refresh del token del bot fallo: ${res.status} — rehacer /setup/twitch-bot`)
        return row.access_token
      }

      const json = await res.json()
      await this.supabase.db
        .from('st_bot_tokens')
        .update({
          access_token:  json.access_token,
          refresh_token: json.refresh_token ?? row.refresh_token,
          expires_at:    new Date(Date.now() + (json.expires_in ?? 14400) * 1000).toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq('platform', 'TWITCH')

      this.logger.log('Token del bot de Twitch refrescado')
      return json.access_token
    } catch (err) {
      this.logger.warn(`getBotToken error: ${err}`)
      return null
    }
  }

  /** Refresca el token antes de que expire (Twitch dura ~4h) y reconecta si hace falta. */
  @Cron('0 */3 * * *')
  async refreshLoop() {
    if (this.stopped) return
    const token = await this.getBotToken()
    if (token && (!this.client || this.client.destroyed)) this.connect(token)
  }

  // --- IRC ---

  private connect(token: string) {
    if (this.stopped) return
    const username = this.botUsername
    if (!username) {
      this.logger.warn('Streamea Twitch: falta bot_username en st_bot_tokens')
      return
    }

    this.client = new net.Socket()
    this.joined.clear()

    this.client.connect(6667, 'irc.chat.twitch.tv', () => {
      this.send(`PASS oauth:${token.replace(/^oauth:/, '')}`)
      this.send(`NICK ${username}`)
      this.send('CAP REQ :twitch.tv/commands twitch.tv/tags')

      for (const login of this.tenants.keys()) {
        this.send(`JOIN #${login}`)
        this.joined.add(login)
      }

      this.pingTimer = setInterval(() => this.send('PING :tmi.twitch.tv'), 4 * 60 * 1000)
      this.logger.log(`Streamea Twitch conectado como ${username} — ${this.joined.size} canal(es)`)
    })

    this.client.on('data', data => {
      data.toString().split('\r\n').filter(Boolean).forEach(line => this.handleLine(line))
    })

    this.client.on('error', err => this.logger.warn(`IRC error: ${err.message}`))

    this.client.on('close', () => {
      if (this.pingTimer) clearInterval(this.pingTimer)
      this.joined.clear()
      if (this.stopped) return
      this.logger.warn('Streamea Twitch: IRC desconectado — reconectando en 30s')
      this.reconnectTimer = setTimeout(() => this.start(), 30_000)
    })
  }

  private send(message: string) {
    this.client?.write(`${message}\r\n`)
  }

  sendChat(channel: string, message: string) {
    const ch = channel.toLowerCase()
    if (!this.joined.has(ch)) return
    this.send(`PRIVMSG #${ch} :${message}`)
    this.logger.log(`[${ch}] -> ${message}`)
  }

  private async handleLine(line: string) {
    if (line.startsWith('PING')) {
      this.send('PONG :tmi.twitch.tv')
      return
    }
    if (!line.includes('PRIVMSG')) return

    const userMatch    = line.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG/)
    const channelMatch = line.match(/PRIVMSG #(\w+) :/)
    const textMatch    = line.match(/PRIVMSG #\w+ :(.+)/)
    if (!userMatch || !channelMatch || !textMatch) return

    const username = userMatch[1].toLowerCase()
    const channel  = channelMatch[1].toLowerCase()
    const content  = textMatch[1].trim()

    const tenant = this.tenants.get(channel)
    if (!tenant) return

    // Los badges vienen en los tags IRC (CAP twitch.tv/tags)
    const isMod = username === channel
      || /badges=[^;]*\b(broadcaster|moderator)\/1/.test(line)
      || /;mod=1/.test(line)

    await this.handleMessage(tenant, username, content, isMod)
  }

  private async handleMessage(
    tenant: TwitchTenant, username: string, rawContent: string, isMod: boolean,
  ) {
    const content = rawContent.toLowerCase()
    if (!content) return

    await this.checkRaffleEntry(tenant, username, content)

    if (!content.startsWith('!')) return

    if (content.startsWith('!addcom ') || content.startsWith('!delcom ')) {
      if (!isMod) return
      if (content.startsWith('!addcom ')) return this.addCommand(tenant, rawContent)
      return this.delCommand(tenant, content)
    }

    const commands = await this.loadCommands(tenant)
    const response = commands[content]
    if (!response) return

    const key = `${tenant.id}:${content}`
    const now = Date.now()
    if (now - (this.cooldowns.get(key) ?? 0) < 30_000) return
    this.cooldowns.set(key, now)

    this.sendChat(tenant.login, response)
  }

  private async addCommand(tenant: TwitchTenant, rawContent: string) {
    const rest     = rawContent.slice('!addcom '.length).trim()
    const spaceIdx = rest.indexOf(' ')
    if (spaceIdx < 0) return

    const command  = rest.slice(0, spaceIdx).toLowerCase()
    const response = rest.slice(spaceIdx + 1).trim()
    if (!command.startsWith('!') || !response) return

    const { error } = await this.supabase.db
      .from('st_commands')
      .upsert({ streamer_id: tenant.id, command, response }, { onConflict: 'streamer_id,command' })

    if (error) {
      this.logger.warn(`addCommand error: ${error.message}`)
      return
    }
    this.commandsCache.delete(tenant.id)
    this.sendChat(tenant.login, `Comando ${command} guardado!`)
  }

  private async delCommand(tenant: TwitchTenant, content: string) {
    const command = content.slice('!delcom '.length).trim()
    if (!command.startsWith('!')) return

    await this.supabase.db
      .from('st_commands')
      .delete()
      .eq('streamer_id', tenant.id)
      .eq('command', command)

    this.commandsCache.delete(tenant.id)
    this.sendChat(tenant.login, `Comando ${command} eliminado!`)
  }

  private async loadCommands(tenant: TwitchTenant): Promise<Record<string, string>> {
    const cached = this.commandsCache.get(tenant.id)
    if (cached && Date.now() - cached.at < 60_000) return cached.map

    const { data } = await this.supabase.db
      .from('st_commands')
      .select('command, response')
      .eq('streamer_id', tenant.id)
      .eq('is_active', true)

    const map: Record<string, string> = {}
    for (const row of (data ?? []) as any[]) {
      map[String(row.command).toLowerCase()] = row.response
    }
    this.commandsCache.set(tenant.id, { at: Date.now(), map })
    return map
  }

  private async checkRaffleEntry(tenant: TwitchTenant, username: string, content: string) {
    try {
      const { data: raffle } = await this.supabase.db
        .from('st_raffles')
        .select('id, keyword')
        .eq('streamer_id', tenant.id)
        .eq('platform', 'TWITCH')
        .eq('status', 'active')
        .maybeSingle()

      if (!raffle) return
      if (content !== String((raffle as any).keyword).toLowerCase().trim()) return

      const { error } = await this.supabase.db
        .from('st_raffle_entries')
        .insert({ raffle_id: (raffle as any).id, username })

      if (!error) this.logger.log(`Sorteo ${tenant.displayName} (Twitch): entra ${username}`)
    } catch (err) {
      this.logger.warn(`checkRaffleEntry error: ${err}`)
    }
  }

  // --- Auto-moderador ---

  /**
   * Hace moderador al bot en el canal del streamer usando el token del PROPIO streamer
   * (requiere que haya autorizado el scope channel:manage:moderators).
   */
  async makeBotModerator(streamerId: string): Promise<{ ok: boolean; message: string }> {
    const { data } = await this.supabase.db
      .from('st_streamers')
      .select('twitch_user_id, twitch_access_token, twitch_refresh_token, twitch_expires_at')
      .eq('id', streamerId)
      .maybeSingle()

    const row = data as any
    if (!row?.twitch_user_id || !row?.twitch_access_token) {
      return { ok: false, message: 'El streamer no tiene Twitch conectado' }
    }

    const { data: botRow } = await this.supabase.db
      .from('st_bot_tokens')
      .select('bot_user_id')
      .eq('platform', 'TWITCH')
      .maybeSingle()

    const botUserId = (botRow as any)?.bot_user_id
    if (!botUserId) return { ok: false, message: 'Falta configurar la cuenta bot de Twitch' }

    const token = await this.streamerToken(streamerId, row)
    if (!token) return { ok: false, message: 'No pudimos renovar el acceso a Twitch. Reconectá tu cuenta.' }

    const url = `${HELIX_BASE}/moderation/moderators?broadcaster_id=${row.twitch_user_id}&user_id=${botUserId}`
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id':   this.config.get<string>('TWITCH_CLIENT_ID') ?? '',
      },
    })

    if (res.status === 204) return { ok: true, message: 'Bot agregado como moderador' }
    if (res.status === 422) return { ok: true, message: 'El bot ya era moderador' }

    const body = await res.text()
    this.logger.warn(`makeBotModerator fallo: ${res.status} ${body}`)
    if (res.status === 401) {
      return { ok: false, message: 'Falta permiso. Reconectá Twitch para autorizar la gestión de moderadores.' }
    }
    return { ok: false, message: `Twitch respondió ${res.status}` }
  }

  /** Devuelve un token valido del streamer, refrescandolo si hace falta. */
  private async streamerToken(streamerId: string, row: any): Promise<string | null> {
    const expiresAt = row.twitch_expires_at ? new Date(row.twitch_expires_at).getTime() : 0
    if (Date.now() < expiresAt - 5 * 60 * 1000) return row.twitch_access_token
    if (!row.twitch_refresh_token) return row.twitch_access_token

    try {
      const res = await fetch(TWITCH_OAUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: row.twitch_refresh_token,
          client_id:     this.config.get<string>('TWITCH_CLIENT_ID')     ?? '',
          client_secret: this.config.get<string>('TWITCH_CLIENT_SECRET') ?? '',
        }),
      })
      if (!res.ok) return null

      const json = await res.json()
      await this.supabase.db
        .from('st_streamers')
        .update({
          twitch_access_token:  json.access_token,
          twitch_refresh_token: json.refresh_token ?? row.twitch_refresh_token,
          twitch_expires_at:    new Date(Date.now() + (json.expires_in ?? 14400) * 1000).toISOString(),
          updated_at:           new Date().toISOString(),
        })
        .eq('id', streamerId)

      return json.access_token
    } catch (err) {
      this.logger.warn(`streamerToken refresh error: ${err}`)
      return null
    }
  }
}
