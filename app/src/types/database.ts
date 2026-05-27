export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── ENUMS ────────────────────────────────────────────────────────────────────
export type SocialPlatform = 'DISCORD' | 'TWITCH' | 'YOUTUBE' | 'TWITTER' | 'TELEGRAM'

export type XpEventType =
  | 'DISCORD_MESSAGE'
  | 'DISCORD_REACTION_RECEIVED'
  | 'DISCORD_HELPED_USER'
  | 'TWITCH_WATCH_TIME'
  | 'TWITCH_RAID_PARTICIPATE'
  | 'YOUTUBE_COMMENT'
  | 'YOUTUBE_SHARE'
  | 'TWITTER_SHARE'
  | 'MISSION_COMPLETED'
  | 'STREAK_BONUS'
  | 'BADGE_EARNED'
  | 'ADMIN_MANUAL_GRANT'

export type MissionType = 'DAILY' | 'WEEKLY' | 'SPECIAL' | 'EVENT'
export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'LEGENDARY'
export type RaffleStatus = 'PENDING' | 'ACTIVE' | 'DRAWN' | 'CANCELLED'
export type StreakType = 'DAILY_ACTIVE' | 'STREAM_VIEWER' | 'WEEKLY_PARTICIPANT'

// ─── TABLAS ───────────────────────────────────────────────────────────────────
export interface Profile {
  id: string
  discord_id: string
  discord_tag: string
  username: string
  avatar_url: string | null
  bio: string | null
  is_admin: boolean
  is_banned: boolean
  ban_reason: string | null
  created_at: string
  updated_at: string
}

export interface UserReputation {
  id: string
  user_id: string
  total_xp: number
  weekly_xp: number
  monthly_xp: number
  level: number
  discord_messages: number
  twitch_minutes: number
  youtube_comments: number
  twitter_shares: number
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  raffle_tickets: number
  updated_at: string
}

export interface UserSocialLink {
  id: string
  user_id: string
  platform: SocialPlatform
  external_id: string
  username: string
  is_verified: boolean
  connected_at: string
}

export interface XpEvent {
  id: string
  user_id: string
  event_type: XpEventType
  platform: SocialPlatform
  xp_awarded: number
  base_xp: number
  multiplier: number
  quality_score: number
  streak_bonus: number
  external_ref: string | null
  metadata: Json | null
  created_at: string
}

export interface XpConfig {
  id: string
  event_type: XpEventType
  base_xp: number
  cooldown_sec: number
  daily_cap: number
  is_enabled: boolean
  updated_at: string
  updated_by: string | null
}

export interface Mission {
  id: string
  title: string
  description: string
  type: MissionType
  is_active: boolean
  objective_type: XpEventType
  target_count: number
  xp_reward: number
  ticket_reward: number
  badge_reward: string | null
  starts_at: string
  ends_at: string
  min_level: number | null
  required_platforms: SocialPlatform[]
  created_at: string
}

export interface UserMission {
  id: string
  user_id: string
  mission_id: string
  progress: number
  is_completed: boolean
  is_claimed: boolean
  completed_at: string | null
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
  image_url: string
  tier: BadgeTier
  condition: Json
  is_secret: boolean
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
}

export interface Raffle {
  id: string
  title: string
  description: string
  prize: string
  status: RaffleStatus
  min_level: number | null
  min_xp: number | null
  required_platforms: SocialPlatform[]
  use_weighted: boolean
  starts_at: string
  ends_at: string
  drawn_at: string | null
  winner_id: string | null
  created_at: string
}

export interface RafflePool {
  id: string
  raffle_id: string
  user_id: string
  tickets: number
}

export interface UserStreak {
  id: string
  user_id: string
  streak_type: StreakType
  current_days: number
  longest_days: number
  last_checkin: string | null
}

export interface DiscordRoleMapping {
  id: string
  min_level: number
  max_level: number | null
  discord_role_id: string
  role_name: string
}

// ─── TIPOS COMPUESTOS (para queries con joins) ────────────────────────────────
export interface ProfileWithReputation extends Profile {
  user_reputation: UserReputation | null
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url: string | null
  level: number
  total_xp: number
  weekly_xp: number
}

export interface MissionWithProgress extends Mission {
  user_missions: UserMission[]
}

// ─── DATABASE TYPE (para el cliente de Supabase con tipos) ───────────────────
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'is_admin' | 'is_banned'>
        Update: Partial<Omit<Profile, 'id' | 'discord_id' | 'created_at'>>
      }
      user_reputation: {
        Row: UserReputation
        Insert: Pick<UserReputation, 'user_id'>
        Update: Partial<Omit<UserReputation, 'id' | 'user_id'>>
      }
      user_social_links: {
        Row: UserSocialLink
        Insert: Omit<UserSocialLink, 'id' | 'connected_at'>
        Update: Partial<Omit<UserSocialLink, 'id' | 'user_id'>>
      }
      xp_events: {
        Row: XpEvent
        Insert: Omit<XpEvent, 'id' | 'created_at'>
        Update: never
      }
      xp_config: {
        Row: XpConfig
        Insert: Omit<XpConfig, 'id' | 'updated_at'>
        Update: Partial<Omit<XpConfig, 'id'>>
      }
      missions: {
        Row: Mission
        Insert: Omit<Mission, 'id' | 'created_at'>
        Update: Partial<Omit<Mission, 'id' | 'created_at'>>
      }
      user_missions: {
        Row: UserMission
        Insert: Omit<UserMission, 'id' | 'is_completed' | 'is_claimed' | 'completed_at'>
        Update: Partial<Omit<UserMission, 'id' | 'user_id' | 'mission_id'>>
      }
      badges: {
        Row: Badge
        Insert: Omit<Badge, 'id' | 'created_at'>
        Update: Partial<Omit<Badge, 'id' | 'created_at'>>
      }
      user_badges: {
        Row: UserBadge
        Insert: Omit<UserBadge, 'id' | 'earned_at'>
        Update: never
      }
      raffles: {
        Row: Raffle
        Insert: Omit<Raffle, 'id' | 'created_at' | 'status' | 'drawn_at' | 'winner_id'>
        Update: Partial<Omit<Raffle, 'id' | 'created_at'>>
      }
      raffle_pools: {
        Row: RafflePool
        Insert: Omit<RafflePool, 'id'>
        Update: Partial<Pick<RafflePool, 'tickets'>>
      }
      user_streaks: {
        Row: UserStreak
        Insert: Omit<UserStreak, 'id' | 'current_days' | 'longest_days' | 'last_checkin'>
        Update: Partial<Omit<UserStreak, 'id' | 'user_id' | 'streak_type'>>
      }
      discord_role_mappings: {
        Row: DiscordRoleMapping
        Insert: Omit<DiscordRoleMapping, 'id'>
        Update: Partial<Omit<DiscordRoleMapping, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: {
      award_xp: {
        Args: {
          p_user_id: string
          p_event_type: XpEventType
          p_platform: SocialPlatform
          p_xp: number
          p_base_xp: number
          p_multiplier: number
          p_quality: number
          p_streak: number
          p_ref?: string
          p_metadata?: Json
        }
        Returns: void
      }
    }
    Enums: {
      social_platform: SocialPlatform
      xp_event_type: XpEventType
      mission_type: MissionType
      badge_tier: BadgeTier
      raffle_status: RaffleStatus
      streak_type: StreakType
    }
  }
}
