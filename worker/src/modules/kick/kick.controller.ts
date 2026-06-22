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
