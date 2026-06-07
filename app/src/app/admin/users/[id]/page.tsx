import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Zap, Flame, Trophy, Shield, Calendar } from 'lucide-react'
import AdminUserActions from './AdminUserActions'
import { getLevelTitle, getLevelColor, formatNumber, timeAgo } from '@/lib/utils'

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
  STREAK_BONUS:              'Bonus de racha',
  BADGE_EARNED:              'Badge desbloqueado',
  ADMIN_MANUAL_GRANT:        'XP manual admin',
}

const PLATFORM_COLOR: Record<string, { dot: string; bg: string }> = {
  DISCORD:  { dot: 'bg-indigo-400',  bg: 'bg-indigo-400/10'  },
  TWITCH:   { dot: 'bg-purple-400',  bg: 'bg-purple-400/10'  },
  YOUTUBE:  { dot: 'bg-red-400',     bg: 'bg-red-400/10'     },
  TELEGRAM: { dot: 'bg-sky-400',     bg: 'bg-sky-400/10'     },
  SYSTEM:   { dot: 'bg-primary',     bg: 'bg-primary/10'     },
}

const TIER_COLORS: Record<string, string> = {
  BRONZE:    'border-amber-700/30 bg-amber-700/10',
  SILVER:    'border-slate-400/30 bg-slate-400/10',
  GOLD:      'border-yellow-400/30 bg-yellow-400/10',
  LEGENDARY: 'border-purple-400/30 bg-purple-400/10',
}

const PLATFORM_ICONS: Record<string, string> = {
  DISCORD: '🎮', TWITCH: '🟣', YOUTUBE: '🔴', TELEGRAM: '✈️',
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) redirect('/login')

  const { data: adminProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', adminUser.id).single()
  if (!adminProfile?.is_admin) redirect('/dashboard')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [profileRes, repRes, eventsRes, badgesRes, allBadgesRes, missionsRes, linksRes] = await Promise.all([
    admin.from('profiles').select('id, username, discord_tag, avatar_url, created_at, is_admin, is_banned').eq('id', id).single(),
    admin.from('user_reputation').select('*').eq('user_id', id).single(),
    admin.from('xp_events').select('event_type, xp_awarded, created_at, platform').eq('user_id', id).order('created_at', { ascending: false }).limit(25),
    admin.from('user_badges').select('badge_id, earned_at').eq('user_id', id),
    admin.from('badges').select('id, name, image_url, tier, family').not('family', 'is', null),
    admin.from('user_missions').select('*, missions(title)').eq('user_id', id).eq('is_completed', true).order('completed_at', { ascending: false }).limit(10),
    admin.from('user_social_links').select('platform, username').eq('user_id', id),
  ])

  if (!profileRes.data) notFound()

  const profile   = profileRes.data
  const rep       = repRes.data
  const events    = eventsRes.data ?? []
  const earnedSet = new Set((badgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges = allBadgesRes.data ?? []
  const missions  = missionsRes.data ?? []
  const links     = linksRes.data ?? []

  const earnedBadges = allBadges.filter(b => earnedSet.has(b.id))
  const level = rep?.level ?? 1

  // XP por plataforma
  const xpByPlatform: Record<string, number> = {}
  for (const e of events) {
    const p = (e.platform as string) ?? 'SYSTEM'
    xpByPlatform[p] = (xpByPlatform[p] ?? 0) + e.xp_awarded
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <span className="text-sm text-muted-foreground">Usuarios / <span className="text-foreground font-medium">{profile.username}</span></span>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-16 h-16 rounded-2xl" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{profile.username[0].toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-foreground">{profile.username}</h1>
              {profile.is_admin && (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              )}
              {profile.is_banned && (
                <span className="text-[10px] font-bold bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">Baneado</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{profile.discord_tag}</p>
            <p className={`text-xs font-semibold mt-1 ${getLevelColor(level)}`}>
              Nv. {level} — {getLevelTitle(level)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary">{formatNumber(rep?.total_xp ?? 0)}</p>
            <p className="text-xs text-muted-foreground">XP total</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          {[
            { label: 'XP semanal',   value: formatNumber(rep?.weekly_xp  ?? 0), icon: Zap,      color: 'text-yellow-400' },
            { label: 'XP mensual',   value: formatNumber(rep?.monthly_xp ?? 0), icon: Trophy,   color: 'text-green-400'  },
            { label: 'Racha actual', value: `${rep?.current_streak ?? 0}d`,      icon: Flame,    color: 'text-orange-400' },
            { label: 'Miembro desde', value: new Date(profile.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }), icon: Calendar, color: 'text-blue-400', small: true },
          ].map(({ label, value, icon: Icon, color, small }: any) => (
            <div key={label} className="text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className={`font-bold text-foreground ${small ? 'text-xs' : 'text-base'}`}>{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Plataformas conectadas */}
        {links.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
            {links.map((l: any) => (
              <span key={l.platform} className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-lg">
                {PLATFORM_ICONS[l.platform] ?? '🔗'} @{l.username}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Badges ganados */}
      {earnedBadges.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Badges ({earnedBadges.length})</h2>
          <div className="flex flex-wrap gap-2">
            {earnedBadges.map((b: any) => (
              <div key={b.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${TIER_COLORS[b.tier] ?? 'border-border bg-secondary/30'}`}>
                <span>{b.image_url || '🏅'}</span>
                <span className="text-foreground">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Misiones completadas */}
      {missions.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Misiones completadas (últimas 10)</h2>
          </div>
          <div className="divide-y divide-border">
            {missions.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-sm text-foreground">{m.missions?.title ?? 'Misión'}</p>
                <span className="text-xs text-muted-foreground">
                  {m.completed_at ? timeAgo(m.completed_at) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones admin */}
      <AdminUserActions
        userId={id}
        username={profile.username}
        isAdmin={profile.is_admin ?? false}
        isBanned={profile.is_banned ?? false}
        allBadges={allBadges}
        earnedBadgeIds={[...earnedSet]}
      />

      {/* Actividad reciente */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Actividad reciente (últimos 25 eventos)</h2>
        </div>
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin actividad registrada.</p>
          ) : events.map((e: any, i) => {
            const platform = e.platform ?? 'SYSTEM'
            const pc = PLATFORM_COLOR[platform] ?? PLATFORM_COLOR.SYSTEM
            return (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${pc.dot}`} />
                <p className="text-sm text-foreground flex-1">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
                <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                <span className="text-sm font-bold text-primary shrink-0 w-20 text-right">+{e.xp_awarded} XP</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
