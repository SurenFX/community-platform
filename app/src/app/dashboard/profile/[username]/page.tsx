import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Shield, Flame, Trophy, Zap, Calendar } from 'lucide-react'
import { getLevelTitle, getLevelColor, xpForCurrentLevel, xpForNextLevel } from '@/lib/utils'
import ProfileEditButton from '@/components/profile/ProfileEditButton'

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:           'Mensaje en Discord',
  DISCORD_REACTION_RECEIVED: 'Reacción recibida',
  DISCORD_HELPED_USER:       'Ayudó a alguien',
  TWITCH_WATCH_TIME:         'Vio el stream',
  TWITCH_CHAT_MESSAGE:       'Chat en el stream',
  TWITCH_FOLLOW:             'Siguió el canal',
  TWITCH_SUBSCRIBE:          'Sub al canal',
  TWITCH_RAID_PARTICIPATE:   'Participó en raid',
  YOUTUBE_COMMENT:           'Comentó en YouTube',
  YOUTUBE_SUBSCRIBE:         'Se suscribió en YouTube',
  TELEGRAM_MESSAGE:          'Mensaje en Telegram',
  MISSION_COMPLETED:         'Completó una misión',
  STREAK_BONUS:              'Bonus de racha 🔥',
  ADMIN_MANUAL_GRANT:        'XP otorgado por admin',
}

const PLATFORM_ICONS: Record<string, string> = {
  DISCORD:  '🎮',
  TWITCH:   '🟣',
  YOUTUBE:  '🔴',
  TELEGRAM: '✈️',
}

const RARITY_COLORS: Record<string, string> = {
  BRONZE:    'border-amber-700/30 bg-amber-700/10',
  SILVER:    'border-slate-400/30 bg-slate-400/10',
  GOLD:      'border-yellow-400/30 bg-yellow-400/10',
  LEGENDARY: 'border-purple-400/30 bg-purple-400/10',
  // legacy
  COMMON:    'border-gray-500/30 bg-gray-500/10',
  UNCOMMON:  'border-green-500/30 bg-green-500/10',
  RARE:      'border-blue-500/30 bg-blue-500/10',
  EPIC:      'border-purple-500/30 bg-purple-500/10',
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // Usuario autenticado (para mostrar botón de editar en perfil propio)
  const authClient = await createClient()
  const { data: { user: currentUser } } = await authClient.auth.getUser()

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Queries separadas para evitar problemas con joins anidados
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, discord_tag, avatar_url, bio, created_at, is_admin')
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
      .eq('user_id', profile.id),
    supabase
      .from('xp_events')
      .select('event_type, xp_awarded, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('xp_events')
      .select('platform, xp_awarded')
      .eq('user_id', profile.id),
  ])

  const rep       = repRes.data
  const earnedIds = new Set((badgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges = allBadgesRes.data ?? []
  const links     = linksRes.data ?? []
  const events    = eventsRes.data ?? []
  const allEvents = (eventsRes2 as any)?.data ?? []

  // Desglose de XP por plataforma
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

  // Agrupar badges por familia
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
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="h-24 xp-bar opacity-30" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username}
                className="w-20 h-20 rounded-2xl ring-4 ring-card border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-card border-2 border-border bg-primary/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {profile.username[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="mb-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-foreground">{profile.username}</h1>
                {isOwner && (
                  <ProfileEditButton username={profile.username} bio={profile.bio} />
                )}
                {profile.is_admin && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
                <span className={`text-xs font-bold ${getLevelColor(level)}`}>
                  Nv. {level} — {getLevelTitle(level)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{profile.discord_tag}</p>
            </div>
          </div>

          {profile.bio && (
            <p className="text-sm text-muted-foreground mb-4">{profile.bio}</p>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
              <span>Nv. {level + 1}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full xp-bar rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>

          {links.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {links.map((link: any) => (
                <span key={link.platform} className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-lg">
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
          { label: 'XP Total',    value: totalXp.toLocaleString(),           icon: Zap,      color: 'text-yellow-400' },
          { label: 'Racha',       value: `${rep?.current_streak ?? 0} días`,  icon: Flame,    color: 'text-orange-400' },
          { label: 'Mejor racha', value: `${rep?.longest_streak ?? 0} días`,  icon: Trophy,   color: 'text-purple-400' },
          { label: 'Miembro',     value: memberSince,                         icon: Calendar, color: 'text-blue-400',  small: true },
        ].map(({ label, value, icon: Icon, color, small }: any) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
            <p className={`font-bold text-foreground ${small ? 'text-xs' : 'text-lg'}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Desglose XP por plataforma */}
      {platformBreakdown.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
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
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-semibold ${p.color}`}>{p.label}</span>
                    <span className="text-muted-foreground">{xp.toLocaleString()} XP · {pct}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${p.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">Badges</h2>
          <span className="text-xs text-muted-foreground">
            {earnedIds.size} / {allBadges.length} desbloqueados
          </span>
        </div>

        <div className="space-y-5">
          {Object.entries(badgesByFamily).map(([family, fBadges]) => {
            const earned = fBadges.filter(b => earnedIds.has(b.id))
            return (
              <div key={family}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {FAMILY_LABELS[family] ?? family}
                  </p>
                  <span className="text-xs text-muted-foreground">{earned.length}/{fBadges.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {fBadges.map((badge: any) => {
                    const isEarned = earnedIds.has(badge.id)
                    return (
                      <div
                        key={badge.id}
                        className={`border rounded-xl p-3 flex items-center gap-3 transition-all ${
                          isEarned
                            ? RARITY_COLORS[badge.tier ?? 'COMMON']
                            : 'border-border bg-secondary/30 opacity-40 grayscale'
                        }`}
                      >
                        <span className="text-2xl">{badge.image_url || '🏅'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{badge.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {isEarned ? badge.description : '???'}
                          </p>
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
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-border">
            {events.map((event: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {EVENT_LABELS[event.event_type] ?? event.event_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(event.created_at)}</p>
                </div>
                <span className="text-sm font-bold text-primary">+{event.xp_awarded} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
