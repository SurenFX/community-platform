import { Controller, Post, Req, Headers, HttpCode, Logger } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import * as crypto from 'crypto'
import { StreameaKickService, type Tenant } from './streamea-kick.service'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

const KICK_PUBLIC_KEY_URL = 'https://api.kick.com/public/v1/public-key'

/**
 * Webhook unico de Kick para Streamea.
 *
 * Kick manda TODOS los eventos de la app a una sola URL, asi que aca se resuelve
 * a que streamer (tenant) pertenece cada evento mirando `broadcaster.user_id`.
 */
@Controller('streamea')
export class StreameaController {
  private readonly logger = new Logger(StreameaController.name)
  private publicKeyCache: string | null = null

  // Cache de comandos por tenant (60s) y cooldowns por comando
  private commandsCache = new Map<string, { at: number; map: Record<string, string> }>()
  private cooldowns     = new Map<string, number>()

  constructor(
    private kick:     StreameaKickService,
    private supabase: SupabaseService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      const messageId = headers['kick-event-message-id']
      const timestamp = headers['kick-event-message-timestamp']
      const signature = headers['kick-event-signature']
      const eventType = headers['kick-event-type']
      const raw       = req.rawBody?.toString('utf8') ?? ''

      if (!messageId || !timestamp || !signature) {
        this.logger.warn('webhook: faltan headers de firma -- ignorado')
        return { ok: true }
      }
      if (!(await this.verifySignature(messageId, timestamp, raw, signature))) {
        this.logger.warn('webhook: firma invalida -- ignorado')
        return { ok: true }
      }

      const payload = raw ? JSON.parse(raw) : {}
      const tenant  = this.kick.getTenant(payload?.broadcaster?.user_id)

      if (!tenant) {
        this.logger.warn(`webhook: evento de un canal sin tenant (broadcaster=${payload?.broadcaster?.user_id})`)
        return { ok: true }
      }

      if (eventType === 'chat.message.sent') {
        await this.handleChatMessage(tenant, payload)
      }
    } catch (err) {
      this.logger.warn(`webhook error: ${err}`)
    }
    return { ok: true }
  }

  // --- Chat ---

  private async handleChatMessage(tenant: Tenant, payload: any) {
    const rawContent = String(payload?.content ?? '').trim()
    const content    = rawContent.toLowerCase()
    if (!content) return

    // 1) Sorteo activo: si el mensaje es la keyword, registra la entrada
    await this.checkRaffleEntry(tenant, payload, content)

    if (!content.startsWith('!')) return

    // 2) Comandos de gestion (solo broadcaster o mods)
    if (content.startsWith('!addcom ') || content.startsWith('!delcom ')) {
      if (!this.isModerator(payload)) return
      if (content.startsWith('!addcom ')) return this.addCommand(tenant, rawContent)
      return this.delCommand(tenant, content)
    }

    // 3) Comando custom del streamer
    const commands = await this.loadCommands(tenant)
    const response = commands[content]
    if (!response) return

    const key      = `${tenant.id}:${content}`
    const now      = Date.now()
    const lastUsed = this.cooldowns.get(key) ?? 0
    if (now - lastUsed < 30_000) return
    this.cooldowns.set(key, now)

    await this.kick.sendChat(tenant.broadcasterId, response)
  }

  private isModerator(payload: any): boolean {
    const senderId      = payload?.sender?.user_id
    const broadcasterId = payload?.broadcaster?.user_id
    if (senderId != null && senderId === broadcasterId) return true

    const badges: any[] = payload?.sender?.identity?.badges ?? []
    const isMod = badges.some(b => b?.type === 'moderator' || b?.type === 'broadcaster')
    if (!isMod) {
      this.logger.warn(
        `isModerator: false (sender=${senderId}, broadcaster=${broadcasterId}, ` +
        `badges=${JSON.stringify(badges.map(b => b?.type))})`,
      )
    }
    return isMod
  }

  private async addCommand(tenant: Tenant, rawContent: string) {
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
    await this.kick.sendChat(tenant.broadcasterId, `Comando ${command} guardado!`)
  }

  private async delCommand(tenant: Tenant, content: string) {
    const command = content.slice('!delcom '.length).trim()
    if (!command.startsWith('!')) return

    await this.supabase.db
      .from('st_commands')
      .delete()
      .eq('streamer_id', tenant.id)
      .eq('command', command)

    this.commandsCache.delete(tenant.id)
    await this.kick.sendChat(tenant.broadcasterId, `Comando ${command} eliminado!`)
  }

  private async loadCommands(tenant: Tenant): Promise<Record<string, string>> {
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

  // --- Sorteos ---

  private async checkRaffleEntry(tenant: Tenant, payload: any, content: string) {
    try {
      const username = payload?.sender?.username
      if (!username) return

      const { data: raffle } = await this.supabase.db
        .from('st_raffles')
        .select('id, keyword')
        .eq('streamer_id', tenant.id)
        .eq('platform', 'KICK')
        .eq('status', 'active')
        .maybeSingle()

      if (!raffle) return
      if (content !== String((raffle as any).keyword).toLowerCase().trim()) return

      const { error } = await this.supabase.db
        .from('st_raffle_entries')
        .insert({
          raffle_id: (raffle as any).id,
          username:  String(username).toLowerCase(),
        })

      // El UNIQUE(raffle_id, username) evita duplicados: si ya estaba, no es error real
      if (!error) {
        this.logger.log(`Sorteo ${tenant.displayName}: entra ${username}`)
      }
    } catch (err) {
      this.logger.warn(`checkRaffleEntry error: ${err}`)
    }
  }

  // --- Firma ---

  private async getPublicKey(): Promise<string | null> {
    if (this.publicKeyCache) return this.publicKeyCache
    try {
      const res = await fetch(KICK_PUBLIC_KEY_URL)
      if (!res.ok) return null
      const data = await res.json()
      this.publicKeyCache = data?.data?.public_key ?? null
      return this.publicKeyCache
    } catch (err) {
      this.logger.warn(`getPublicKey error: ${err}`)
      return null
    }
  }

  private async verifySignature(
    messageId: string, timestamp: string, rawBody: string, signatureB64: string,
  ): Promise<boolean> {
    const publicKey = await this.getPublicKey()
    if (!publicKey) return false
    try {
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(`${messageId}.${timestamp}.${rawBody}`)
      verifier.end()
      return verifier.verify(publicKey, signatureB64, 'base64')
    } catch (err) {
      this.logger.warn(`verifySignature error: ${err}`)
      return false
    }
  }
}
