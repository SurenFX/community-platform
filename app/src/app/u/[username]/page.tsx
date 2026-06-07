import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Shield, Flame, Trophy, Zap, Calendar } from 'lucide-react'
import { getLevelTitle, getLevelColor, xpForCurrentLevel, xpForNextLevel } from '@/lib/utils'
import ProfileEditButton from '@/components/profile/ProfileEditButton'

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
    .from('profiles').select('username, bio, avatar_url').eq('username', decodeURIComponent(username)).single()
  if (!profile) return { title: 'Perfil — SalchiNeta' }

  const { data: rep } = await supabase
    .from('user_reputation').select('level, total_xp').eq('user_id', (profile as any).id).single()

  const title = `${profile.username} — SalchiNeta`
  const description = profile.bio
    ?? (rep ? `Nivel ${(rep as any).level} · ${(rep as any).total_xp.toLocaleString()} XP en SalchiNeta` : 'Perfil en SalchiNeta')

  return {
    title,
    description,
    openGraph: {
      title, description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
    twitter: {
      card: 'summary', title, description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
  }
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

const BORDER_COLOR_HEX: Record<string, string> = {
  'cyan-400':   '#22d3ee', 'green-400':  '#4ade80', 'violet-400': '#a78bfa',
  'red-500':    '#ef4444', 'pink-400':   '#f472b6', 'yellow-400': '#facc15',
  'orange-400': '#fb923c', 'purple-500': '#a855f7',
}

const PLATFORM_ICONS: Record<string, string> = {
  DISCORD: '🎮', TWITCH: '🟣', YOUTUBE: '🔴', TELEGRAM: '✈️',
}

const FAMILY_LABELS: Record<string, string> = {
  discord: '💬 Discord', stream: '🟣 Stream', streak: '🔥 Racha',
  level: '⭐ Nivel', missions: '🎯 Misiones', youtube: '📹 YouTube',
  telegram: '✈️ Telegram', seniority: '🏛️ Antigüedad', special: '🏅 Especiales',
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

  const [repRes, badgesRes, allBadgesRes, linksRes] = await Promise.all([
    supabase.from('user_reputation')
      .select('total_xp, level, current_streak, longest_streak').eq('user_id', profile.id).single(),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', profile.id),
    supabase.from('badges').select('id, name, description, image_url, tier, family, family_order')
      .eq('is_secret', false).not('family', 'is', null).order('family').order('family_order'),
    supabase.from('user_social_links').select('platform, username').eq('user_id', profile.id).eq('is_public', true),
  ])

  const rep       = repRes.data as any
  const earnedIds = new Set((badgesRes.data ?? []).map((b: any) => b.badge_id))
  const earnedDates = new Map((badgesRes.data ?? []).map((b: any) => [b.badge_id, b.earned_at as string]))
  const allBadges = allBadgesRes.data ?? []
  const links     = linksRes.data ?? []

  const badgesByFamily: Record<string, any[]> = {}
  for (const badge of allBadges) {
    const fam = (badge as any).family ?? 'other'
    if (!badgesByFamily[fam]) badgesByFamily[fam] = []
    badgesByFamily[fam].push(badge)
  }

  const level     = rep?.level ?? 1
  const totalXp   = rep?.total_xp ?? 0
  const borderHex = BORDER_COLOR_HEX[(profile as any).equipped_border_color ?? '']
  const nameEmoji = (profile as any).equipped_name_emoji as string | null
  const titleOverride = (profile as any).equipped_title_override as string | null

  const xpCurrent = totalXp - xpForCurrentLevel(level)
  const xpNeeded  = xpForNextLevel(level) - xpForCurrentLevel(level)
  const xpPercent = xpNeeded > 0 ? Math.min(100, Math.round((xpCurrent / xpNeeded) * 100)) : 0

  const memberSince = new Date(profile.created_at).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Nav mínima */}
      <nav className="border-b border-border px-4 py-3 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="text-lg font-black text-primary">SalchiNeta</Link>
        <Link href="/login"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
          Entrar
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="h-24 relative overflow-hidden">
            <div className="absolute inset-0 xp-bar opacity-20" />
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 30% 50%, hsl(185 100% 45% / 0.3) 0%, transparent 60%)' }} />
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10 mb-4">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username}
                  className="w-20 h-20 rounded-2xl ring-4 ring-card shadow-xl"
                  style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 20px ${borderHex}50` } : { border: '2px solid hsl(var(--border))' }} />
              ) : (
                <div className="w-20 h-20 rounded-2xl ring-4 ring-card bg-primary/20 flex items-center justify-center shadow-xl"
                  style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 20px ${borderHex}50` } : {}}>
                  <span className="text-2xl font-bold text-primary">{profile.username[0].toUpperCase()}</span>
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
                  {profile.is_admin && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  )}
                  <span className={`text-xs font-bold ${getLevelColor(level)}`}>
                    Nv. {level} — {titleOverride ?? getLevelTitle(level)}
                  </span>
                </div>
                {profile.discord_tag && (
                  <p className="text-sm text-muted-foreground">{profile.discord_tag}</p>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mb-4 italic">"{profile.bio}"</p>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
                <span className="font-semibold">Nv. {level + 1}</span>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full xp-bar rounded-full transition-all duration-700" style={{ width: `${xpPercent}%` }} />
              </div>
            </div>

            {links.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {links.map((link: any) => (
                  <span key={link.platform}
                    className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-lg border border-border/50">
                    {PLATFORM_ICONS[link.platform] ?? '🔗'} @{link.username}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'XP Total',    value: totalXp.toLocaleString(),         icon: Zap,      color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { label: 'Racha',       value: `${rep?.current_streak ?? 0}d`,   icon: Flame,    color: 'text-orange-400', bg: 'bg-orange-400/10' },
            { label: 'Mejor racha', value: `${rep?.longest_streak ?? 0}d`,   icon: Trophy,   color: 'text-purple-400', bg: 'bg-purple-400/10' },
            { label: 'Miembro',     value: memberSince,                       icon: Calendar, color: 'text-blue-400',   bg: 'bg-blue-400/10', small: true },
          ].map(({ label, value, icon: Icon, color, bg, small }: any) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`font-bold text-foreground ${small ? 'text-xs leading-tight' : 'text-lg'}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Badges */}
        {allBadges.length > 0 && (
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
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {FAMILY_LABELS[family] ?? family}
                      </p>
                      <span className="text-xs text-muted-foreground">{earned.length}/{fBadges.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {fBadges.map((badge: any) => {
                        const isEarned = earnedIds.has(badge.id)
                        const earnedAt = earnedDates.get(badge.id)
                        const earnedStr = earnedAt
                          ? new Date(earnedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                          : undefined
                        return (
                          <div key={badge.id}
                            title={isEarned && earnedStr ? `Ganado el ${earnedStr}` : undefined}
                            className={`border rounded-xl p-3 flex items-center gap-3 transition-all ${
                              isEarned
                                ? `${RARITY_COLORS[badge.tier ?? 'COMMON']}`
                                : 'border-border bg-secondary/30 opacity-35 grayscale'
                            }`}>
                            <span className="text-2xl shrink-0">{badge.image_url || '🏅'}</span>
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
        )}

        {/* CTA */}
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">¿Sos parte de la comunidad?</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all">
            Entrar a SalchiNeta 🌭
          </Link>
        </div>
      </div>
    </div>
  )
}
