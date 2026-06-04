import { Injectable } from '@nestjs/common'

export type XpEventType =
  | 'DISCORD_MESSAGE'
  | 'DISCORD_REACTION_RECEIVED'
  | 'DISCORD_HELPED_USER'
  | 'TWITCH_WATCH_TIME'
  | 'TWITCH_RAID_PARTICIPATE'
  | 'TWITCH_CHAT_MESSAGE'
  | 'TWITCH_FOLLOW'
  | 'TWITCH_SUBSCRIBE'
  | 'TWITCH_GIFT_SUB'
  | 'YOUTUBE_COMMENT'
  | 'YOUTUBE_SHARE'
  | 'YOUTUBE_SUBSCRIBE'
  | 'YOUTUBE_LIKE'
  | 'MISSION_COMPLETED'
  | 'STREAK_BONUS'
  | 'BADGE_EARNED'
  | 'ADMIN_MANUAL_GRANT'
  | 'TELEGRAM_MESSAGE'

export type SocialPlatform = 'DISCORD' | 'TWITCH' | 'YOUTUBE' | 'TWITTER' | 'TELEGRAM'

export interface XpConfig {
  event_type:   XpEventType
  base_xp:      number
  cooldown_sec: number
  daily_cap:    number
  is_enabled:   boolean
}

export interface XpCalculation {
  xpAwarded:    number
  baseXp:       number
  multiplier:   number
  qualityScore: number
  streakBonus:  number
}

@Injectable()
export class XpCalculatorService {

  calculate(params: {
    config:       XpConfig
    platform:     SocialPlatform
    qualityScore: number
    streakDays:   number
    metadata?:    Record<string, unknown>
  }): XpCalculation {
    const { config, platform, qualityScore, streakDays } = params

    const multiplier  = this.getPlatformMultiplier(platform)
    const streakBonus = this.getStreakBonus(streakDays)
    const eventWeight = this.getEventWeight(config.event_type, params.metadata)

    const raw       = config.base_xp * multiplier * qualityScore * streakBonus * eventWeight
    const xpAwarded = Math.max(1, Math.round(raw))

    return { xpAwarded, baseXp: config.base_xp, multiplier, qualityScore, streakBonus }
  }

  private getPlatformMultiplier(platform: SocialPlatform): number {
    const map: Record<SocialPlatform, number> = {
      DISCORD:  1.0,
      TWITCH:   1.2,
      YOUTUBE:  1.1,
      TWITTER:  1.15,
      TELEGRAM: 0.9,
    }
    return map[platform] ?? 1.0
  }

  private getStreakBonus(days: number): number {
    if (days < 3)  return 1.0
    if (days < 7)  return 1.2
    if (days < 14) return 1.4
    if (days < 30) return 1.6
    return 1.8
  }

  private getEventWeight(eventType: XpEventType, metadata?: Record<string, unknown>): number {
    if (eventType === 'DISCORD_REACTION_RECEIVED') {
      const count = (metadata?.reaction_count as number) ?? 1
      return Math.min(3.0, 1.0 + count * 0.2)
    }
    return 1.0
  }
}
