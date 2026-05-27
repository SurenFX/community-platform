import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../infrastructure/redis/redis.service'
import type { XpEventType, XpConfig } from './xp-calculator.service'

export interface AntiSpamResult {
  allowed: boolean
  reason?: string
  qualityScore: number
}

@Injectable()
export class AntiSpamService {
  private readonly logger = new Logger(AntiSpamService.name)

  constructor(private redis: RedisService) {}

  async validate(
    userId: string,
    eventType: XpEventType,
    config: XpConfig,
    metadata?: Record<string, unknown>,
  ): Promise<AntiSpamResult> {

    // CHECK 1: Cooldown
    if (config.cooldown_sec > 0) {
      const cooldownKey = `cd:${userId}:${eventType}`
      const onCooldown  = await this.redis.exists(cooldownKey)
      if (onCooldown) return { allowed: false, reason: 'COOLDOWN', qualityScore: 0 }
    }

    // CHECK 2: Daily cap
    const today   = new Date().toISOString().slice(0, 10)
    const capKey  = `cap:${userId}:${eventType}:${today}`
    const dailyXp = parseInt((await this.redis.get(capKey)) ?? '0')
    if (dailyXp >= config.daily_cap) {
      return { allowed: false, reason: 'DAILY_CAP', qualityScore: 0 }
    }

    // CHECK 3: Velocity
    const velocityKey  = `vel:${userId}:${eventType}`
    const recentCount  = await this.redis.incr(velocityKey)
    if (recentCount === 1) await this.redis.expire(velocityKey, 60)
    const velocityLimit = this.getVelocityLimit(eventType)
    if (recentCount > velocityLimit) {
      this.logger.warn(`Velocity exceeded: user=${userId} event=${eventType}`)
      await this.flagUser(userId, eventType)
      return { allowed: false, reason: 'VELOCITY', qualityScore: 0 }
    }

    // CHECK 4: Quality
    const qualityScore = this.assessQuality(eventType, metadata)
    if (qualityScore < 0.2) {
      return { allowed: false, reason: 'LOW_QUALITY', qualityScore }
    }

    // Todo OK — setear cooldown y actualizar daily cap
    if (config.cooldown_sec > 0) {
      await this.redis.set(`cd:${userId}:${eventType}`, '1', config.cooldown_sec)
    }
    await this.redis.set(capKey, (dailyXp + config.base_xp).toString(), 86400)

    return { allowed: true, qualityScore }
  }

  private assessQuality(eventType: XpEventType, metadata?: Record<string, unknown>): number {
    if (eventType !== 'DISCORD_MESSAGE') return 1.0
    const content = metadata?.content as string | undefined
    if (!content) return 0.5
    let score = 1.0
    if (content.length < 5)                                       score -= 0.6
    if (content.length < 15)                                      score -= 0.2
    if (!/[a-zA-Z]{3,}/.test(content))                           score -= 0.4
    if (/(.)\1{4,}/.test(content))                                score -= 0.4
    if (content === content.toUpperCase() && content.length > 10) score -= 0.2
    if (content.split(/\s+/).filter(Boolean).length < 2)          score -= 0.2
    return Math.max(0, score)
  }

  private getVelocityLimit(eventType: XpEventType): number {
    const limits: Partial<Record<XpEventType, number>> = {
      DISCORD_MESSAGE:           20,
      DISCORD_REACTION_RECEIVED: 50,
      TWITCH_WATCH_TIME:         6,
      DISCORD_HELPED_USER:       5,
    }
    return limits[eventType] ?? 10
  }

  private async flagUser(userId: string, eventType: XpEventType) {
    const flagKey = `flags:${userId}`
    const flags   = await this.redis.incr(flagKey)
    await this.redis.expire(flagKey, 86400)
    if (flags >= 10) {
      this.logger.error(`⚠️  Usuario sospechoso: ${userId} — ${flags} flags en 24h`)
    }
  }
}
