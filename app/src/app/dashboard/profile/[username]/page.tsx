import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Shield, Flame, Trophy, Zap, Calendar } from 'lucide-react'
import { getLevelTitle, getLevelColor, xpForCurrentLevel, xpForNextLevel } from '@/lib/utils'
import ProfileEditButton from '@/components/profile/ProfileEditButton'
import CopyProfileLink from '@/components/profile/CopyProfileLink'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url')
    .eq('username', decodeURIComponent(username))
    .single()

  if (!profile) return { title: 'Perfil — SalchiNeta' }

  const { data: rep } = await supabase
    .from('user_reputation')
    .select('level, total_xp')
    .eq('user_id', profile.id)
    .single()

  const title = `${profile.username} — SalchiNeta`
  const description = profile.bio
    ?? (rep ? `Nivel ${rep.level} · ${rep.total_xp.toLocaleString()} XP en SalchiNeta` : 'Perfil en SalchiNeta')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
  }
}

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:           'Mensaje en Discord',
  DISCORD_REACTION_RECEIVED: 'Reacción recibida',
  DISCORD_REACTION_GIVEN:    'Reacción dada',
  DISCORD_HELPED_USER:       'Ayudó a alguien',
  DISCORD_VOICE_TIME:        'Tiempo en voz',
  DISCORD_JOIN:              'Se unió al servidor',
  TWITCH_WATCH_TIME:         'Vio el stream',
  TWITCH_CHAT_MESSAGE:       'Chat en el stream',
  TWITCH_FOLLOW:             'Siguió el canal',
  TWITCH_SUBSCRIBE:          'Sub al canal',
  TWITCH_GIFT_SUB:           'Gift sub',
  TWITCH_RAID_PARTICIPATE:   'Participó en raid',
  YOUTUBE_COMMENT:           'Comentó en YouTube',
  YOUTUBE_SUBSCRIBE:         'Se suscribió en YouTube',
  YOUTUBE_SHARE:             'Compartió un video',
  TELEGRAM_MESSAGE:          'Mensaje en Telegram',
  TELEGRAM_JOIN:             'Se unió al grupo',
  TELEGRAM_REACTION:         'Reacción en Telegram',
  MISSION_COMPLETED:         'Completó una misión',
  STREAK_BONUS:              'Bonus de racha 🔥',
  BADGE_EARNED:              'Badge desbloqueado',
  ADMIN_MANUAL_GRANT:        'XP otorgado por admin',
}

const EVENT_SUBLABEL = (event: any): string | null => {
  switch (event.event_type) {
    case 'DISCORD_VOICE_TIME':  return '10 min en canal de voz'
    case 'TWITCH_WATCH_TIME':   return '10 min viendo el stream'
    case 'YOUTUBE_COMMENT':     return event.metadata?.comment_text
      ? `"${String(event.metadata.comment_text).slice(0, 40)}${String(event.metadata.comment_text).length > 40 ? '…' : ''}"`
      : null
    default: return null
  }
}

const PLATFORM_ICONS: Record<string, string> = {
  DISCORD:  '🎮',
  TWITCH:   '🟣',
  YOUTUBE:  '🔴',
  TELEGRAM: '✈️',
}

const PLATFORM_COLOR: Record<string, string> = {
  DISCORD:  'bg-indigo-500/20 text-indigo-300',
  TWITCH:   'bg-purple-500/20 text-purple-300',
  YOUTUBE:  'bg-red-500/20 text-red-300',
  TELEGRAM: 'bg-sky-500/20 text-sky-300',
  SYSTEM:   'bg-primary/20 text-primary',
}

const EVENT_PLATFORM: Record<string, string> = {
  DISCORD_MESSAGE:           'DISCORD',
  DISCORD_REACTION_RECEIVED: 'DISCORD',
  DISCORD_REACTION_GIVEN:    'DISCORD',
  DISCORD_HELPED_USER:       'DISCORD',
  DISCORD_VOICE_TIME:        'DISCORD',
  DISCORD_JOIN:              'DISCORD',
  TWITCH_WATCH_TIME:         'TWITCH',
  TWITCH_CHAT_MESSAGE:       'TWITCH',
  TWITCH_FOLLOW:             'TWITCH',
  TWITCH_SUBSCRIBE:          'TWITCH',
  TWITCH_GIFT_SUB:           'TWITCH',
  TWITCH_RAID_PARTICIPATE:   'TWITCH',
  YOUTUBE_COMMENT:           'YOUTUBE',
  YOUTUBE_SUBSCRIBE:         'YOUTUBE',
  YOUTUBE_SHARE:             'YOUTUBE',
  TELEGRAM_MESSAGE:          'TELEGRAM',
  TELEGRAM_JOIN:             'TELEGRAM',
  TELEGRAM_REACTION:         'TELEGRAM',
  MISSION_COMPLETED:         'SYSTEM',
  STREAK_BONUS:              'SYSTEM',
  BADGE_EARNED:              'SYSTEM',
  ADMIN_MANUAL_GRANT:        'SYSTEM',
}

const RARITY_COLORS: Record<string, string> = {
  BRONZE:    'border-amber-700/40 bg-amber-700/10',
  SILVER:    'border-slate-400/40 bg-slate-400/10',
  GOLD:      'border-yellow-400/40 bg-yellow-400/10',
  LEGENDARY: 'border-purple-400/40 bg-purple-400/10',
  COMMON:    'border-gray-500/30 bg-gray-500/10',
  UNCOMMON:  'border-green-500/30 bg-green-500/10',
  RARE:      'border-blue-500/30 bg-blue-500/10',
  EPIC:      'border-purple-500/30 bg-purple-500/10',
}

const RARITY_GLOW: Record<string, string> = {
  LEGENDARY: '0 0 12px hsl(270 80% 60% / 0.3)',
  GOLD:      '0 0 10px hsl(45 100% 55% / 0.25)',
  EPIC:      '0 0 10px hsl(270 80% 60% / 0.2)',
  RARE:      '0 0 8px hsl(210 80% 60% / 0.2)',
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const authClient = await createClient()
  const { data: { user: currentUser } } = await authClient.auth.getUser()

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, discord_tag, avatar_url, bio, created_at, is_admin, equipped_border_color, equipped_name_emoji, equipped_title_override')
    .eq('username', decodeURIComponent(username))
    .single()

  if (!profile) notFound()

  const isOwner = currentUser?.id === profile.id

  const [repRes, badgesRes, allBadgesRes, linksRes, eventsRes, eventsRes2] = await Promise.all([
    supabase
      .from('user_reputation')
      .select('total_xp, level, weekly_xp, monthly_xp, current_streak, longest_streak, raffle_tickets')
      .eq('user_id', profile.id)
      .single(),
    supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', profile.id),
    supabase
      .from('badges')
      .select('id, slug, name, description, image_url, tier, family, family_order')
      .eq('is_secret', false)
      .not('family', 'is', null)
      .order('family')
      .order('family_order'),
    supabase
      .from('user_social_links')
      .select('platform, username')
      .eq('user_id', profile.id)
      .eq('is_public', true),
    supabase
      .from('xp_events')
      .select('event_type, xp_awarded, created_at, metadata, platform')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('xp_events')
      .select('platform, xp_awarded')
      .eq('user_id', profile.id),
  ])

  const rep        = repRes.data
  const earnedIds  = new Set((badgesRes.data ?? []).map((b: any) => b.badge_id))
  const earnedDates = new Map((badgesRes.data ?? []).map((b: any) => [b.badge_id, b.earned_at as string]))
  const allBadges = allBadgesRes.data ?? []
  const links     = linksRes.data ?? []
  const events    = eventsRes.data ?? []
  const allEvents = (eventsRes2 as any)?.data ?? []

  // XP por plataforma
  const xpByPlatform: Record<string, number> = {}
  for (const e of allEvents) {
    if (!e.platform || e.platform === 'DISCORD' && e.xp_awarded === 0) continue
    xpByPlatform[e.platform] = (xpByPlatform[e.platform] ?? 0) + e.xp_awarded
  }
  const totalXpAllPlatforms = Object.values(xpByPlatform).reduce((a, b) => a + b, 0)
  const platformBreakdown = Object.entries(xpByPlatform)
    .sort((a, b) => b[1] - a[1])
    .map(([platform, xp]) => ({
      platform,
      xp,
      pct: totalXpAllPlatforms > 0 ? Math.round((xp / totalXpAllPlatforms) * 100) : 0,
    }))

  // Badges por familia
  const badgesByFamily: Record<string, any[]> = {}
  for (const badge of allBadges) {
    const fam = (badge as any).family ?? 'other'
    if (!badgesByFamily[fam]) badgesByFamily[fam] = []
    badgesByFamily[fam].push(badge)
  }

  const FAMILY_LABELS: Record<string, string> = {
    discord:   '💬 Discord',
    stream:    '🟣 Stream',
    streak:    '🔥 Racha',
    level:     '⭐ Nivel',
    missions:  '🎯 Misiones',
    youtube:   '📹 YouTube',
    telegram:  '✈️ Telegram',
    seniority: '🏛️ Antigüedad',
    special:   '🏅 Especiales',
  }

  const level   = rep?.level ?? 1
  const totalXp = rep?.total_xp ?? 0

  const BORDER_COLOR_HEX: Record<string, string> = {
    'cyan-400':   '#22d3ee', 'green-400':  '#4ade80', 'violet-400': '#a78bfa',
    'red-500':    '#ef4444', 'pink-400':   '#f472b6', 'yellow-400': '#facc15',
    'orange-400': '#fb923c', 'purple-500': '#a855f7',
  }
  const borderHex = BORDER_COLOR_HEX[(profile as any).equipped_border_color ?? '']
  const nameEmoji = (profile as any).equipped_name_emoji as string | null
  const titleOverride = (profile as any).equipped_title_override as string | null

  const xpCurrent = totalXp - xpForCurrentLevel(level)
  const xpNeeded  = xpForNextLevel(level) - xpForCurrentLevel(level)
  const xpPercent = xpNeeded > 0 ? Math.min(100, Math.round((xpCurrent / xpNeeded) * 100)) : 0

  const memberSince = new Date(profile.created_at).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
    if (d === 0) return 'hoy'
    if (d === 1) return 'ayer'
    if (d < 30)  return `hace ${d}d`
    return `hace ${Math.floor(d / 30)}m`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="fade-in-up bg-card border border-border rounded-2xl overflow-hidden">
        {/* Banner con gradiente animado */}
        <div className="h-28 relative overflow-hidden">
          <div className="absolute inset-0 xp-bar opacity-25" />
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 30% 50%, hsl(185 100% 45% / 0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, hsl(45 100% 55% / 0.2) 0%, transparent 60%)' }} />
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12 mb-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username}
                className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-xl"
                style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 20px ${borderHex}50` } : { border: '2px solid hsl(var(--border))' }} />
            ) : (
              <div className="w-24 h-24 rounded-2xl ring-4 ring-card bg-primary/20 flex items-center justify-center shadow-xl"
                style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 20px ${borderHex}50` } : { border: '2px solid hsl(var(--border))' }}>
                <span className="text-3xl font-bold text-primary">
                  {profile.username[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="mb-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-foreground">
                  {nameEmoji && <span className="mr-1">{nameEmoji}</span>}
                  {profile.username}
                </h1>
                {isOwner && (
                  <ProfileEditButton username={profile.username} bio={profile.bio} />
                )}
                <CopyProfileLink username={profile.username} />
                {profile.is_admin && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
                <span className={`text-xs font-bold ${getLevelColor(level)}`}>
                  Nv. {level} — {titleOverride ?? getLevelTitle(level)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{profile.discord_tag}</p>
            </div>
          </div>

          {profile.bio && (
            <p className="text-sm text-muted-foreground mb-4 italic">"{profile.bio}"</p>
          )}

          {/* XP bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
              <span className="font-semibold">Nv. {level + 1}</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full xp-bar rounded-full transition-all duration-700"
                style={{ width: `${xpPercent}%` }} />
            </div>
          </div>

          {links.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {links.map((link: any) => (
                <span key={link.platform}
                  className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-lg border border-border/50">
                  <span>{PLATFORM_ICONS[link.platform] ?? '🔗'}</span>
                  @{link.username}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'XP Total',    value: totalXp.toLocaleString(),           icon: Zap,      color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: 'Racha',       value: `${rep?.current_streak ?? 0} días`,  icon: Flame,    color: 'text-orange-400', bg: 'bg-orange-400/10' },
          { label: 'Mejor racha', value: `${rep?.longest_streak ?? 0} días`,  icon: Trophy,   color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'Miembro',     value: memberSince,                         icon: Calendar, color: 'text-blue-400',   bg: 'bg-blue-400/10',  small: true },
        ].map(({ label, value, icon: Icon, color, bg, small }: any, i) => (
          <div key={label}
            className="fade-in-up bg-card border border-border rounded-xl p-4 text-center"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`font-bold text-foreground ${small ? 'text-xs leading-tight' : 'text-lg'}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* XP por plataforma */}
      {platformBreakdown.length > 0 && (
        <div className="fade-in-up bg-card border border-border rounded-2xl p-6" style={{ animationDelay: '80ms' }}>
          <h2 className="text-base font-bold text-foreground mb-4">XP por plataforma</h2>
          <div className="space-y-3">
            {platformBreakdown.map(({ platform, xp, pct }) => {
              const cfg: Record<string, { label: string; color: string; bar: string }> = {
                DISCORD:  { label: 'Discord',  color: 'text-indigo-400',  bar: 'bg-indigo-400'  },
                TWITCH:   { label: 'Twitch',   color: 'text-purple-400',  bar: 'bg-purple-400'  },
                YOUTUBE:  { label: 'YouTube',  color: 'text-red-400',     bar: 'bg-red-400'     },
                TELEGRAM: { label: 'Telegram', color: 'text-[#26A5E4]',   bar: 'bg-[#26A5E4]'  },
              }
              const p = cfg[platform] ?? { label: platform, color: 'text-muted-foreground', bar: 'bg-muted-foreground' }
              return (
                <div key={platform}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className={`font-semibold ${p.color}`}>{p.label}</span>
                    <span className="text-muted-foreground">{xp.toLocaleString()} XP · {pct}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${p.bar}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="fade-in-up bg-card border border-border rounded-2xl p-6" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">Badges</h2>
          <span className="text-xs text-muted-foreground">
            {earnedIds.size} / {allBadges.length} desbloqueados
          </span>
        </div>

        <div className="space-y-5">
          {Object.entries(badgesByFamily).map(([family, fBadges], fi) => {
            const earned = fBadges.filter(b => earnedIds.has(b.id))
            return (
              <div key={family}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {FAMILY_LABELS[family] ?? family}
                  </p>
                  <span className="text-xs text-muted-foreground">{earned.length}/{fBadges.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {fBadges.map((badge: any, bi) => {
                    const isEarned = earnedIds.has(badge.id)
                    const glow      = RARITY_GLOW[badge.tier ?? ''] ?? undefined
                    const earnedAt  = earnedDates.get(badge.id)
                    const earnedStr = earnedAt
                      ? new Date(earnedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : undefined
                    return (
                      <div
                        key={badge.id}
                        title={isEarned && earnedStr ? `Ganado el ${earnedStr}` : undefined}
                        className={`fade-in-up border rounded-xl p-3 flex items-center gap-3 transition-all ${
                          isEarned
                            ? `${RARITY_COLORS[badge.tier ?? 'COMMON']} badge-earned cursor-default`
                            : 'border-border bg-secondary/30 opacity-35 grayscale'
                        }`}
                        style={{
                          animationDelay: `${(fi * 3 + bi) * 30}ms`,
                          ...(isEarned && glow ? { boxShadow: glow } : {}),
                        }}
                      >
                        <span className="text-2xl shrink-0">{badge.image_url || '🏅'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{badge.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {isEarned ? badge.description : '???'}
                          </p>
                          {isEarned && badge.tier && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 inline-block ${
                              badge.tier === 'LEGENDARY' ? 'text-purple-400'
                              : badge.tier === 'GOLD'    ? 'text-yellow-400'
                              : badge.tier === 'SILVER'  ? 'text-slate-400'
                              : 'text-amber-700'
                            }`}>{badge.tier}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actividad reciente */}
      {events.length > 0 && (
        <div className="fade-in-up bg-card border border-border rounded-2xl overflow-hidden" style={{ animationDelay: '160ms' }}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-border">
            {events.map((event: any, i: number) => {
              const platform = event.platform ?? EVENT_PLATFORM[event.event_type] ?? 'SYSTEM'
              const colorClass = PLATFORM_COLOR[platform] ?? 'bg-primary/20 text-primary'
              const icon = PLATFORM_ICONS[platform] ?? '⚡'
              const sublabel = EVENT_SUBLABEL(event)
              return (
                <div key={i}
                  className="fade-in-up row-hover flex items-center gap-3 px-5 py-3"
                  style={{ animationDelay: `${160 + i * 30}ms` }}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${colorClass}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {EVENT_LABELS[event.event_type] ?? event.event_type}
                    </p>
                    {sublabel && (
                      <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60">{timeAgo(event.created_at)}</p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">+{event.xp_awarded} XP</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
