import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Shield, Flame, Zap, Calendar, Star, Clock, TrendingUp, Award } from 'lucide-react'
import { getLevelTitle, getLevelColor, xpForCurrentLevel, xpForNextLevel, getRankTier } from '@/lib/utils'
import ProfileEditButton from '@/components/profile/ProfileEditButton'
import { PrestigeBadge } from '@/components/profile/PrestigeModal'
import CopyProfileLink from '@/components/profile/CopyProfileLink'
import ActivityHeatmap from '@/components/profile/ActivityHeatmap'
import ShareCardButton from '@/components/profile/ShareCardButton'

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
  const { data: profile } = await supabase.from('profiles').select('id, username, bio, avatar_url').eq('username', decodeURIComponent(username)).single()
  if (!profile) return { title: 'Perfil — SalchiNeta' }
  const { data: rep } = await supabase.from('user_reputation').select('level, total_xp').eq('user_id', profile.id).single()
  const title = `${profile.username} — SalchiNeta`
  const description = profile.bio ?? (rep ? `Nivel ${rep.level} · ${rep.total_xp.toLocaleString()} XP` : 'Perfil en SalchiNeta')
  return { title, description, openGraph: { title, description, ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}) } }
}

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE: 'Mensaje en Discord', DISCORD_REACTION_RECEIVED: 'Reaccion recibida',
  DISCORD_REACTION_GIVEN: 'Reaccion dada', DISCORD_HELPED_USER: 'Ayudo a alguien',
  DISCORD_VOICE_TIME: 'Tiempo en voz', DISCORD_JOIN: 'Se unio al servidor',
  TWITCH_WATCH_TIME: 'Vio el stream', TWITCH_CHAT_MESSAGE: 'Chat en el stream',
  TWITCH_FOLLOW: 'Siguio el canal', TWITCH_SUBSCRIBE: 'Sub al canal',
  TWITCH_GIFT_SUB: 'Gift sub', TWITCH_RAID_PARTICIPATE: 'Participo en raid',
  YOUTUBE_COMMENT: 'Comento en YouTube', YOUTUBE_SUBSCRIBE: 'Se suscribio en YouTube',
  TELEGRAM_MESSAGE: 'Mensaje en Telegram', TELEGRAM_JOIN: 'Se unio al grupo',
  TELEGRAM_REACTION: 'Reaccion en Telegram', MISSION_COMPLETED: 'Completo una mision',
  STREAK_BONUS: 'Bonus de racha', BADGE_EARNED: 'Logro desbloqueado',
  ADMIN_MANUAL_GRANT: 'XP otorgado por admin',
}

const PLATFORM_META: Record<string, { label: string; color: string; bar: string; text: string }> = {
  DISCORD:  { label: 'Discord',  color: 'bg-indigo-500/20',  bar: 'bg-indigo-400',  text: 'text-indigo-300'  },
  TWITCH:   { label: 'Twitch',   color: 'bg-purple-500/20',  bar: 'bg-purple-400',  text: 'text-purple-300'  },
  YOUTUBE:  { label: 'YouTube',  color: 'bg-red-500/20',     bar: 'bg-red-400',     text: 'text-red-300'     },
  TELEGRAM: { label: 'Telegram', color: 'bg-sky-500/20',     bar: 'bg-sky-400',     text: 'text-sky-300'     },
  SYSTEM:   { label: 'Sistema',  color: 'bg-primary/20',     bar: 'bg-primary',     text: 'text-primary'     },
}

const RARITY_COLORS: Record<string, string> = {
  BRONZE: 'border-amber-700/50 bg-amber-700/10', SILVER: 'border-slate-400/50 bg-slate-400/10',
  GOLD:   'border-yellow-400/50 bg-yellow-400/10', LEGENDARY: 'border-purple-400/50 bg-purple-400/10',
}
const RARITY_GLOW: Record<string, string> = {
  LEGENDARY: '0 0 14px hsl(270 80% 60% / 0.35)', GOLD: '0 0 10px hsl(45 100% 55% / 0.3)',
}

const FAMILY_LABELS: Record<string, string> = {
  discord: 'Discord', stream: 'Stream', streak: 'Racha', level: 'Nivel',
  missions: 'Misiones', youtube: 'YouTube', telegram: 'Telegram',
  seniority: 'Antiguedad', special: 'Especiales',
}

const BORDER_COLOR_HEX: Record<string, string> = {
  'cyan-400': '#22d3ee', 'green-400': '#4ade80', 'violet-400': '#a78bfa',
  'red-500': '#ef4444', 'pink-400': '#f472b6', 'yellow-400': '#facc15',
  'orange-400': '#fb923c', 'purple-500': '#a855f7',
}

const EVENT_PLATFORM: Record<string, string> = {
  DISCORD_MESSAGE: 'DISCORD', DISCORD_REACTION_RECEIVED: 'DISCORD', DISCORD_REACTION_GIVEN: 'DISCORD',
  DISCORD_HELPED_USER: 'DISCORD', DISCORD_VOICE_TIME: 'DISCORD', DISCORD_JOIN: 'DISCORD',
  TWITCH_WATCH_TIME: 'TWITCH', TWITCH_CHAT_MESSAGE: 'TWITCH', TWITCH_FOLLOW: 'TWITCH',
  TWITCH_SUBSCRIBE: 'TWITCH', TWITCH_GIFT_SUB: 'TWITCH', TWITCH_RAID_PARTICIPATE: 'TWITCH',
  YOUTUBE_COMMENT: 'YOUTUBE', YOUTUBE_SUBSCRIBE: 'YOUTUBE', YOUTUBE_SHARE: 'YOUTUBE',
  TELEGRAM_MESSAGE: 'TELEGRAM', TELEGRAM_JOIN: 'TELEGRAM', TELEGRAM_REACTION: 'TELEGRAM',
  MISSION_COMPLETED: 'SYSTEM', STREAK_BONUS: 'SYSTEM', BADGE_EARNED: 'SYSTEM', ADMIN_MANUAL_GRANT: 'SYSTEM',
}

function timeAgo(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30)  return `hace ${d}d`
  return `hace ${Math.floor(d / 30)}m`
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
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

  const [repRes, badgesRes, allBadgesRes, linksRes, eventsRes, allEventsRes, levelHistoryRes] = await Promise.all([
    supabase.from('user_reputation').select('total_xp, level, weekly_xp, monthly_xp, current_streak, longest_streak, prestige_level').eq('user_id', profile.id).single(),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', profile.id),
    supabase.from('badges').select('id, slug, name, description, image_url, tier, family, family_order, is_secret').not('family', 'is', null).order('family').order('family_order'),
    supabase.from('user_social_links').select('platform, username').eq('user_id', profile.id).eq('is_public', true),
    supabase.from('xp_events').select('event_type, xp_awarded, created_at, platform').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(8),
    supabase.from('xp_events').select('platform, xp_awarded, created_at').eq('user_id', profile.id),
    supabase.from('level_history').select('new_level, achieved_at').eq('user_id', profile.id).order('new_level', { ascending: false }).limit(10),
  ])

  const rep          = repRes.data
  const earnedIds    = new Set((badgesRes.data ?? []).map((b: any) => b.badge_id))
  const earnedDates  = new Map((badgesRes.data ?? []).map((b: any) => [b.badge_id, b.earned_at as string]))
  const allBadges    = allBadgesRes.data ?? []
  const links        = linksRes.data ?? []
  const events       = eventsRes.data ?? []
  const allEvents    = (allEventsRes as any)?.data ?? []
  const levelHistory = levelHistoryRes.data ?? []

  const level   = rep?.level ?? 1
  const totalXp = rep?.total_xp ?? 0
  const tier    = getRankTier(level)

  const xpCurrent = totalXp - xpForCurrentLevel(level)
  const xpNeeded  = xpForNextLevel(level) - xpForCurrentLevel(level)
  const xpPercent = xpNeeded > 0 ? Math.min(100, Math.round((xpCurrent / xpNeeded) * 100)) : 0

  const xpByPlatform: Record<string, number> = {}
  for (const e of allEvents) {
    if (!e.platform) continue
    xpByPlatform[e.platform] = (xpByPlatform[e.platform] ?? 0) + e.xp_awarded
  }
  const totalXpAll = Object.values(xpByPlatform).reduce((a, b) => a + b, 0)
  const platformBreakdown = Object.entries(xpByPlatform)
    .sort((a, b) => b[1] - a[1])
    .map(([platform, xp]) => ({ platform, xp, pct: totalXpAll > 0 ? Math.round((xp / totalXpAll) * 100) : 0 }))

  const badgesByFamily: Record<string, any[]> = {}
  for (const badge of allBadges) {
    const fam = (badge as any).family ?? 'other'
    if (!badgesByFamily[fam]) badgesByFamily[fam] = []
    badgesByFamily[fam].push(badge)
  }

  const borderHex     = BORDER_COLOR_HEX[(profile as any).equipped_border_color ?? '']
  const nameEmoji     = (profile as any).equipped_name_emoji as string | null
  const titleOverride = (profile as any).equipped_title_override as string | null
  const displayTitle  = titleOverride ?? getLevelTitle(level)

  const memberSince = new Date(profile.created_at).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <div className="space-y-4">

      {/* ── CARD PRINCIPAL: identidad del personaje ── */}
      <div className="fade-in-up bg-card border border-border rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-24 relative overflow-hidden">
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${tier.color.replace('text-', '')} 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, hsl(185 100% 45% / 0.2) 0%, transparent 70%)`,
            backgroundSize: '100% 100%',
          }} />
          <div className="absolute inset-0 xp-bar opacity-10" />
          {/* Tier label en banner */}
          <div className="absolute top-3 right-4">
            <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${tier.color} ${tier.bg} ${tier.border}`}>
              {tier.label}
            </span>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            {/* Avatar con level badge */}
            <div className="relative shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username}
                  className="w-20 h-20 rounded-2xl ring-4 ring-card shadow-xl"
                  style={borderHex
                    ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 20px ${borderHex}55` }
                    : { border: '2px solid hsl(var(--border))' }} />
              ) : (
                <div className="w-20 h-20 rounded-2xl ring-4 ring-card bg-primary/20 flex items-center justify-center shadow-xl"
                  style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 20px ${borderHex}55` } : { border: '2px solid hsl(var(--border))' }}>
                  <span className="text-2xl font-bold text-primary">{profile.username[0].toUpperCase()}</span>
                </div>
              )}
              {/* Level badge */}
              <div className={`absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black border-2 border-card ${tier.bg}`}
                style={{ boxShadow: `0 0 10px ${tier.color.includes('yellow') ? 'hsl(45 100% 55% / 0.5)' : 'hsl(185 100% 45% / 0.4)'}` }}>
                <span className={tier.color}>{level}</span>
              </div>
            </div>

            {/* Nombre + título */}
            <div className="flex-1 mb-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-foreground">
                  {nameEmoji && <span className="mr-1">{nameEmoji}</span>}
                  {profile.username}
                </h1>
                {(rep as any)?.prestige_level > 0 && <PrestigeBadge prestige={(rep as any).prestige_level} />}
                {profile.is_admin && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
                {isOwner && <ProfileEditButton username={profile.username} bio={profile.bio} />}
                <CopyProfileLink username={profile.username} />
                <ShareCardButton username={profile.username} />
              </div>
              {/* Título de rango prominente */}
              <p className={`text-sm font-bold mt-0.5 ${getLevelColor(level)}`}>{displayTitle}</p>
              <p className="text-xs text-muted-foreground/70">{profile.discord_tag}</p>
            </div>
          </div>

          {profile.bio && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 mb-4">"{profile.bio}"</p>
          )}

          {/* Barra XP al nivel siguiente */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>{xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
              <span className="font-semibold">{xpPercent}% — Nv. {level + 1}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full xp-bar rounded-full transition-all duration-700" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>

          {/* Cuentas vinculadas */}
          {links.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {links.map((link: any) => {
                const pm = PLATFORM_META[link.platform]
                return (
                  <span key={link.platform}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold ${pm?.color ?? 'bg-secondary'} ${pm?.text ?? 'text-muted-foreground'} px-2.5 py-1 rounded-lg`}>
                    @{link.username}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FICHA DE STATS ── */}
      <div className="fade-in-up grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ animationDelay: '40ms' }}>
        {[
          { label: 'XP Total',      value: totalXp.toLocaleString('es-AR'),         icon: Zap,       color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/20' },
          { label: 'Racha actual',  value: `${rep?.current_streak ?? 0}d`,           icon: Flame,     color: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/20' },
          { label: 'Mejor racha',   value: `${rep?.longest_streak ?? 0}d`,           icon: TrendingUp,color: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/20' },
          { label: 'Logros',        value: `${earnedIds.size}/${allBadges.length}`,  icon: Award,     color: 'text-cyan-400',    bg: 'bg-cyan-400/10',    border: 'border-cyan-400/20'   },
        ].map(({ label, value, icon: Icon, color, bg, border }, i) => (
          <div key={label}
            className={`fade-in-up bg-card border ${border} rounded-xl p-4 flex flex-col items-center text-center`}
            style={{ animationDelay: `${40 + i * 50}ms` }}>
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ── XP POR PLATAFORMA ── */}
      {platformBreakdown.length > 0 && (
        <div className="fade-in-up bg-card border border-border rounded-2xl p-5" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Actividad por plataforma</h2>
          </div>
          <div className="space-y-3">
            {platformBreakdown.map(({ platform, xp, pct }) => {
              const p = PLATFORM_META[platform] ?? { label: platform, color: 'bg-secondary', bar: 'bg-muted-foreground', text: 'text-muted-foreground' }
              return (
                <div key={platform}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className={`font-bold ${p.text}`}>{p.label}</span>
                    <span className="text-muted-foreground font-mono">{xp.toLocaleString()} XP · {pct}%</span>
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

      {/* ── HISTORIAL DE NIVEL ── */}
      {levelHistory.length > 0 && (
        <div className="fade-in-up bg-card border border-border rounded-2xl p-5" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Progresion de nivel</h2>
          </div>
          <div className="relative pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-3">
              {levelHistory.map((h: any, i: number) => {
                const t = getRankTier(h.new_level)
                return (
                  <div key={i} className="fade-in-up relative flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className={`absolute -left-5 w-3 h-3 rounded-full border-2 border-card ${t.bg.replace('/10', '/80')}`} />
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${t.color} ${t.bg} ${t.border}`}>
                      <span>Nv. {h.new_level}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{getLevelTitle(h.new_level)}</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(h.achieved_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── HEATMAP DE ACTIVIDAD ── */}
      {allEvents.length > 0 && (
        <ActivityHeatmap events={allEvents as any} />
      )}

      {/* ── LOGROS ── */}
      <div className="fade-in-up bg-card border border-border rounded-2xl p-5" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Logros</h2>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {earnedIds.size}/{allBadges.length} desbloqueados
          </span>
        </div>
        <div className="space-y-4">
          {Object.entries(badgesByFamily).map(([family, fBadges], fi) => {
            const earned = fBadges.filter(b => earnedIds.has(b.id))
            // show all families
            return (
              <div key={family}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {FAMILY_LABELS[family] ?? family}
                  </p>
                  <span className="text-[10px] text-muted-foreground">{earned.length}/{fBadges.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fBadges.map((badge: any, bi) => {
                    const isEarned   = earnedIds.has(badge.id)
                    const isSecret   = badge.is_secret && !isEarned
                    const glow       = isEarned ? RARITY_GLOW[badge.tier ?? ''] : undefined
                    const earnedAt   = earnedDates.get(badge.id)
                    return (
                      <div key={badge.id}
                        title={earnedAt ? `Ganado el ${new Date(earnedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}` : undefined}
                        className={`fade-in-up border rounded-xl p-3 flex items-center gap-3 transition-all ${
                          isEarned ? `${RARITY_COLORS[badge.tier ?? 'COMMON'] ?? 'border-border bg-secondary/30'}` : 'border-border/30 bg-card opacity-30 grayscale'
                        }`}
                        style={{ animationDelay: `${(fi * 3 + bi) * 20}ms`, ...(glow ? { boxShadow: glow } : {}) }}>
                        <span className="text-2xl shrink-0">{badge.image_url || '?'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{isSecret ? '???' : badge.name}</p>
                          {!isSecret && <p className="text-[10px] text-muted-foreground truncate">{badge.description}</p>}
                          {isEarned && badge.tier && (
                            <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 inline-block ${
                              badge.tier === 'LEGENDARY' ? 'text-purple-400' : badge.tier === 'GOLD' ? 'text-yellow-400' : badge.tier === 'SILVER' ? 'text-slate-400' : 'text-amber-700'
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

      {/* ── ACTIVIDAD RECIENTE ── */}
      {events.length > 0 && (
        <div className="fade-in-up bg-card border border-border rounded-2xl overflow-hidden" style={{ animationDelay: '160ms' }}>
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-border">
            {events.map((event: any, i: number) => {
              const platform  = event.platform ?? EVENT_PLATFORM[event.event_type] ?? 'SYSTEM'
              const pm        = PLATFORM_META[platform] ?? PLATFORM_META['SYSTEM']
              return (
                <div key={i} className="fade-in-up flex items-center gap-3 px-5 py-3" style={{ animationDelay: `${160 + i * 25}ms` }}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${pm.color}`}>
                    <Zap className={`w-3.5 h-3.5 ${pm.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                    <p className="text-[10px] text-muted-foreground/60">{timeAgo(event.created_at)}</p>
                  </div>
                  <span className={`text-sm font-black shrink-0 ${pm.text}`}>+{event.xp_awarded}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer: miembro desde */}
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground/50">
        <Calendar className="w-3.5 h-3.5" />
        <span>Miembro desde {memberSince}</span>
      </div>

    </div>
  )
}
