import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Shield, Flame, Trophy, Zap, Calendar } from 'lucide-react'

function getLevelTitle(level: number): string {
  if (level < 5)  return 'Novato'
  if (level < 10) return 'Activo'
  if (level < 20) return 'Veterano'
  if (level < 35) return 'Experto'
  if (level < 50) return 'Élite'
  if (level < 75) return 'Leyenda'
  return 'Mythic'
}

function getLevelColor(level: number): string {
  if (level < 5)  return 'text-gray-400'
  if (level < 10) return 'text-green-400'
  if (level < 20) return 'text-blue-400'
  if (level < 35) return 'text-purple-400'
  if (level < 50) return 'text-yellow-400'
  if (level < 75) return 'text-orange-400'
  return 'text-red-400'
}

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:           'Mensaje en Discord',
  DISCORD_REACTION_RECEIVED: 'Reacción recibida',
  DISCORD_HELPED_USER:       'Ayudó a alguien',
  TWITCH_WATCH_TIME:         'Vio el stream',
  TWITCH_CHAT_MESSAGE:       'Chat en Twitch',
  TWITCH_RAID_PARTICIPATE:   'Participó en raid',
  YOUTUBE_COMMENT:           'Comentó en YouTube',
  YOUTUBE_SUBSCRIBE:         'Se suscribió al canal',
  MISSION_COMPLETED:         'Completó una misión',
  STREAK_BONUS:              'Bonus de racha',
  ADMIN_MANUAL_GRANT:        'XP otorgado por admin',
}

const PLATFORM_ICONS: Record<string, string> = {
  DISCORD: '🎮',
  TWITCH:  '🟣',
  YOUTUBE: '🔴',
}

const RARITY_COLORS: Record<string, string> = {
  COMMON:    'border-gray-500/30 bg-gray-500/10',
  UNCOMMON:  'border-green-500/30 bg-green-500/10',
  RARE:      'border-blue-500/30 bg-blue-500/10',
  EPIC:      'border-purple-500/30 bg-purple-500/10',
  LEGENDARY: 'border-yellow-500/30 bg-yellow-500/10',
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

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

  console.log('Profile:', profile?.username, 'Error:', profileError?.message)

  if (!profile) notFound()

  const [repRes, badgesRes, linksRes, eventsRes] = await Promise.all([
    supabase
      .from('user_reputation')
      .select('total_xp, level, weekly_xp, monthly_xp, current_streak, longest_streak, raffle_tickets')
      .eq('user_id', profile.id)
      .single(),
    supabase
      .from('user_badges')
      .select('earned_at, badges(name, description, icon_url, rarity)')
      .eq('user_id', profile.id),
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
  ])

  const rep    = repRes.data
  const badges = badgesRes.data ?? []
  const links  = linksRes.data ?? []
  const events = eventsRes.data ?? []

  const level   = rep?.level ?? 1
  const totalXp = rep?.total_xp ?? 0

  const xpForLevel = (lvl: number) => lvl * lvl * 100
  const xpCurrent  = totalXp - xpForLevel(level - 1)
  const xpNeeded   = xpForLevel(level) - xpForLevel(level - 1)
  const xpPercent  = Math.min(100, Math.round((xpCurrent / xpNeeded) * 100))

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

      {/* Badges */}
      {badges.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-foreground mb-4">
            Badges <span className="text-muted-foreground font-normal text-sm">({badges.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((ub: any, i: number) => {
              const badge = ub.badges
              return (
                <div key={i} className={`border rounded-xl p-3 flex items-center gap-3 ${RARITY_COLORS[badge?.rarity ?? 'COMMON']}`}>
                  <span className="text-2xl">{badge?.icon_url ?? '🏅'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{badge?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{badge?.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
