import {
  Controller, Post, Body, Headers, Req, HttpCode,
  UnauthorizedException, Logger,
} from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { KickApiService } from './kick-api.service'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'

const KICK_PUBLIC_KEY_URL = 'https://api.kick.com/public/v1/public-key'

@Controller('kick')
export class KickController {
  private readonly logger = new Logger(KickController.name)
  private publicKeyCache: string | null = null

  // Cache de comandos custom (se refresca cada 60s)
  private commandsCache: Record<string, string> = {}
  private commandsCacheAt = 0
  private commandsCooldowns = new Map<string, number>()

  constructor(
    private kickApi:    KickApiService,
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private reputation: ReputationService,
  ) {}

  private verifyWorkerSecret(secret: string) {
    if (!secret || secret !== this.config.get('WORKER_SECRET')) {
      throw new UnauthorizedException()
    }
  }

  @Post('raffle/start')
  async raffleStart(
    @Headers('x-worker-secret') secret: string,
    @Body() body: { keyword: string },
  ) {
    this.verifyWorkerSecret(secret)
    await this.kickApi.sendChat(`Sorteo! Escribi "${body.keyword}" en el chat para participar.`)
    return { ok: true }
  }

  @Post('raffle/winner')
  async raffleWinner(
    @Headers('x-worker-secret') secret: string,
    @Body() body: { winner: string },
  ) {
    this.verifyWorkerSecret(secret)
    await this.kickApi.sendChat(`@${body.winner} es el ganador del sorteo! Felicitaciones!`)
    return { ok: true }
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    try {
      const messageId = headers['kick-event-message-id']
      const timestamp = headers['kick-event-message-timestamp']
      const signature = headers['kick-event-signature']
      const eventType = headers['kick-event-type']
      const raw = req.rawBody?.toString('utf8') ?? ''

      if (!messageId || !timestamp || !signature) {
        this.logger.warn('webhook: faltan headers de firma -- ignorado')
        return { ok: true }
      }

      const valid = await this.verifySignature(messageId, timestamp, raw, signature)
      if (!valid) {
        this.logger.warn('webhook: firma invalida -- ignorado')
        return { ok: true }
      }

      const payload = raw ? JSON.parse(raw) : {}

      switch (eventType) {
        case 'chat.message.sent':
          await this.checkRaffleKeyword(payload)
          await this.checkChatCommands(payload)
          await this.awardChatXp(payload, messageId)
          break
        case 'channel.followed':
          await this.awardFollowXp(payload, messageId)
          break
        case 'channel.subscription.new':
        case 'channel.subscription.renewal':
          await this.awardSubscribeXp(payload, messageId)
          break
      }
    } catch (err) {
      this.logger.warn(`webhook error: ${err}`)
    }
    return { ok: true }
  }

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
      const message = `${messageId}.${timestamp}.${rawBody}`
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(message)
      verifier.end()
      return verifier.verify(publicKey, signatureB64, 'base64')
    } catch (err) {
      this.logger.warn(`verifySignature error: ${err}`)
      return false
    }
  }

  private isModerator(payload: any): boolean {
    const slug   = (this.config.get<string>('KICK_CHANNEL_SLUG') ?? '').toLowerCase()
    const sender = (payload?.sender?.username ?? '').toLowerCase()
    if (sender === slug) return true
    const badges: any[] = payload?.sender?.identity?.badges ?? []
    return badges.some(b => b.type === 'moderator')
  }

  private async loadCommands(): Promise<Record<string, string>> {
    if (Date.now() - this.commandsCacheAt < 60_000) return this.commandsCache
    const { data } = await this.supabase.db
      .from('kick_commands')
      .select('command, response')
    this.commandsCache = {}
    for (const row of (data ?? []) as any[]) {
      this.commandsCache[row.command.toLowerCase()] = row.response
    }
    this.commandsCacheAt = Date.now()
    return this.commandsCache
  }

  private async checkChatCommands(payload: any) {
    const raw     = (payload?.content ?? '').trim()
    const content = raw.toLowerCase()

    // !addcom !cmd respuesta — solo mods/broadcaster
    if (content.startsWith('!addcom ')) {
      if (!this.isModerator(payload)) return
      const rest     = raw.slice('!addcom '.length).trim()
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx < 0) return
      const cmd      = rest.slice(0, spaceIdx).toLowerCase()
      const response = rest.slice(spaceIdx + 1).trim()
      if (!cmd.startsWith('!') || !response) return
      await this.supabase.db
        .from('kick_commands')
        .upsert({ command: cmd, response }, { onConflict: 'command' })
      this.commandsCacheAt = 0
      await this.kickApi.sendChat(`Comando ${cmd} guardado!`)
      return
    }

    // !delcom !cmd — solo mods/broadcaster
    if (content.startsWith('!delcom ')) {
      if (!this.isModerator(payload)) return
      const cmd = content.slice('!delcom '.length).trim()
      if (!cmd.startsWith('!')) return
      await this.supabase.db.from('kick_commands').delete().eq('command', cmd)
      this.commandsCacheAt = 0
      await this.kickApi.sendChat(`Comando ${cmd} eliminado!`)
      return
    }

    // Buscar comando en DB
    const commands = await this.loadCommands()
    const response = commands[content]
    if (!response) return

    const now      = Date.now()
    const lastUsed = this.commandsCooldowns.get(content) ?? 0
    if (now - lastUsed < 30_000) return
    this.commandsCooldowns.set(content, now)

    await this.kickApi.sendChat(response)
  }

  private async checkRaffleKeyword(payload: any) {
    try {
      const kickUsername = payload?.sender?.username
      const content      = payload?.content

      if (!kickUsername || typeof content !== 'string') return

      const { data: raffle } = await this.supabase.db
        .from('kick_raffles')
        .select('id, keyword')
        .eq('status', 'active')
        .single()

      if (!raffle) return
      if (content.toLowerCase().trim() !== raffle.keyword.toLowerCase().trim()) return

      const username = String(kickUsername).toLowerCase()

      const { data: socialLink } = await this.supabase.db
        .from('user_social_links')
        .select('user_id')
        .eq('platform', 'KICK')
        .ilike('username', username)
        .single()

      const { error } = await this.supabase.db
        .from('kick_raffle_entries')
        .insert({
          raffle_id:     raffle.id,
          user_id:       socialLink?.user_id ?? null,
          kick_username: username,
        })

      if (!error) {
        this.logger.log(`Raffle entry: ${username} -> ${raffle.id}`)
      }
    } catch (err) {
      this.logger.warn(`checkRaffleKeyword error: ${err}`)
    }
  }

  private async resolveDiscordId(kickUserId: string | number | undefined): Promise<string | null> {
    if (kickUserId == null) return null
    try {
      const { data: socialLink } = await this.supabase.db
        .from('user_social_links')
        .select('user_id, profiles!inner(discord_id)')
        .eq('platform', 'KICK')
        .eq('external_id', String(kickUserId))
        .single()

      if (!socialLink) return null
      return (socialLink as any).profiles?.discord_id ?? null
    } catch (err) {
      this.logger.warn(`resolveDiscordId error: ${err}`)
      return null
    }
  }

  private async awardChatXp(payload: any, messageId: string) {
    try {
      const kickUserId = payload?.sender?.user_id
      const content    = payload?.content ?? ''
      const discordId  = await this.resolveDiscordId(kickUserId)
      if (!discordId) return

      await this.reputation.processXpEvent({
        discordId,
        eventType:   'KICK_CHAT_MESSAGE',
        platform:    'KICK',
        externalRef: `kick_chat_${messageId}`,
        metadata:    { content: String(content).slice(0, 200) },
      })
    } catch (err) {
      this.logger.warn(`awardChatXp error: ${err}`)
    }
  }

  private async awardFollowXp(payload: any, messageId: string) {
    try {
      const kickUserId = payload?.follower?.user_id
      const discordId  = await this.resolveDiscordId(kickUserId)
      if (!discordId) return

      await this.reputation.processXpEvent({
        discordId,
        eventType:   'KICK_FOLLOW',
        platform:    'KICK',
        externalRef: `kick_follow_${messageId}`,
      })
      this.logger.log(`Kick follow XP: discord=${discordId}`)
    } catch (err) {
      this.logger.warn(`awardFollowXp error: ${err}`)
    }
  }

  private async awardSubscribeXp(payload: any, messageId: string) {
    try {
      const kickUserId = payload?.subscriber?.user_id
      const discordId  = await this.resolveDiscordId(kickUserId)
      if (!discordId) return

      await this.reputation.processXpEvent({
        discordId,
        eventType:   'KICK_SUBSCRIBE',
        platform:    'KICK',
        externalRef: `kick_sub_${messageId}`,
      })
      this.logger.log(`Kick subscribe XP: discord=${discordId}`)
    } catch (err) {
      this.logger.warn(`awardSubscribeXp error: ${err}`)
    }
  }
}
