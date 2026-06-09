import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Swords, MapPin, Flame, Zap, Target, ChevronRight } from 'lucide-react'
import DashboardClient from '@/components/dashboard/DashboardClient'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import DailyBonusCard from '@/components/dashboard/DailyBonusCard'
import SeasonPassTrack from '@/components/dashboard/SeasonPassTrack'
import GlobalXpEventBanner from '@/components/layout/GlobalXpEventBanner'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [profileRes, activityRes, missionsRes, claimableRes, allBadgesRes, earnedBadgesRes, challengeRes, boostsRes] = await Promise.all([
    supabase.from('profiles').select('*, user_reputation(*), user_badges(*, badges(*))').eq('id', user.id).single(),
    supabase.from('xp_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('user_missions').select('*, missions(*)').eq('user_id', user.id).eq('is_completed', false),
    supabase.from('user_missions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_completed', true).eq('is_claimed', false),
    supabase.from('badges').select('id, slug, name, description, image_url, tier, family, family_order, is_secret').not('family', 'is', null).order('family').order('family_order'),
    supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
    admin.from('community_challenges').select('id, title, goal_xp, starts_at, ends_at, reward_xp_per_user, reward_sc_per_user').eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('active_boosts').select('boost_type, boost_value, expires_at').eq('user_id', user.id).gt('expires_at', new Date().toISOString()),
  ])

  const profile        = profileRes.data
  const showOnboarding = profile && !(profile as any).onboarding_completed
  const earnedIds      = new Set((earnedBadgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges      = allBadgesRes.data ?? []
  const claimableCount = claimableRes.count ?? 0
  const challenge      = (challengeRes as any).data

  let challengePct = 0
  if (challenge) {
    const { data: evts } = await admin.from('xp_events').select('xp_awarded').gte('created_at', challenge.starts_at).lte('created_at', challenge.ends_at)
    const total = ((evts ?? []) as any[]).reduce((s: number, e: any) => s + (e.xp_awarded ?? 0), 0)
    challengePct = challenge.goal_xp > 0 ? Math.min(100, Math.round((total / challenge.goal_xp) * 100)) : 0
  }

  const currentLevel = (profile as any)?.user_reputation?.level ?? 1
  const myTotalXp = (profile as any)?.user_reputation?.total_xp ?? 0
  const { count: usersAhead } = await supabase.from('user_reputation').select('*', { count: 'exact', head: true }).gt('total_xp', myTotalXp)
  const myRank = (usersAhead ?? 0) + 1

  const { data: activeSeason } = await admin
    .from('seasons')
    .select('id, name, starts_at, ends_at')
    .eq('status', 'ACTIVE')
    .maybeSingle()

  // Season pass: XP earned this season + claimed milestones
  let seasonXp = 0
  let claimedMilestones: number[] = []
  if (activeSeason) {
    try {
      const [{ data: seasonXpRows }, { data: claimsData }] = await Promise.all([
        admin.from('xp_events')
          .select('xp_awarded')
          .eq('user_id', user.id)
          .gte('created_at', activeSeason.starts_at),
        admin.from('season_pass_claims')
          .select('milestone_xp')
          .eq('user_id', user.id)
          .eq('season_id', activeSeason.id),
      ])
      seasonXp = (seasonXpRows ?? []).reduce((s: number, r: any) => s + (r.xp_awarded ?? 0), 0)
      claimedMilestones = (claimsData ?? []).map((r: any) => r.milestone_xp)
    } catch (_) {
      // season_pass_claims tabla aun no existe, ignorar
    }
  }

  const { data: activeXpEvent } = await admin
    .from('global_xp_events')
    .select('id, title, description, multiplier, ends_at')
    .lte('starts_at', new Date().toISOString())
    .gte('ends_at', new Date().toISOString())
    .order('multiplier', { ascending: false })
    .limit(1)
    .maybeSingle()

  const todayUTC        = new Date().toISOString().slice(0, 10)
  const cookieStore     = await cookies()
  const claimedCookie   = cookieStore.get('daily_bonus_claimed')?.value
  // Use admin client to avoid join array ambiguity and any fetch caching
  const { data: repBonus } = await admin
    .from('user_reputation')
    .select('last_daily_bonus_at')
    .eq('user_id', user.id)
    .single()
  const lastBonusAt     = (repBonus as any)?.last_daily_bonus_at ?? null
  const lastBonusDay    = lastBonusAt ? (lastBonusAt as string).slice(0, 10) : null
  const claimedToday    = lastBonusDay === todayUTC || claimedCookie === todayUTC
  const nextMidnightUTC = new Date(todayUTC + 'T00:00:00Z').getTime() + 86_400_000
  const msUntilNext     = Math.max(0, nextMidnightUTC - Date.now())
  const canClaimBonus   = !claimedToday
  const streak          = (profile as any)?.user_reputation?.current_streak ?? 0

  const buffs: { icon: JSX.Element; label: string; color: string }[] = []
  if (streak >= 30)     buffs.push({ icon: <Flame className="w-3 h-3" />, label: `Racha ${streak}d +200 XP +10 SC`, color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' })
  else if (streak >= 7) buffs.push({ icon: <Flame className="w-3 h-3" />, label: `Racha ${streak}d +100 XP +5 SC`,  color: 'bg-orange-400/15 text-orange-400 border-orange-400/25' })
  else if (streak >= 3) buffs.push({ icon: <Flame className="w-3 h-3" />, label: `Racha ${streak}d +50 XP +2 SC`,   color: 'bg-amber-400/15 text-amber-400 border-amber-400/25'   })

  // Boosts activos del shop
  const activeBoostsList = (boostsRes.data ?? []) as any[]
  for (const b of activeBoostsList) {
    const mins = Math.round((new Date(b.expires_at).getTime() - Date.now()) / 60000)
    const timeLeft = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`
    buffs.push({ icon: <Zap className="w-3 h-3" />, label: `x${b.boost_value} XP (${timeLeft})`, color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' })
  }
  if (challenge)        buffs.push({ icon: <Swords className="w-3 h-3" />, label: `Raid: ${challenge.title}`,       color: 'bg-primary/10 text-primary border-primary/25'         })

  const activeMissions = (missionsRes.data ?? [])
    .filter((um: any) => !um.is_completed && um.missions)
    .map((um: any) => ({ id: um.id, title: um.missions.title, progress: um.progress ?? 0, target: um.missions.target_count ?? 1 }))
    .sort((a: any, b: any) => (b.progress / b.target) - (a.progress / a.target))
    .slice(0, 3)

  const middleContent = (
    <div className="space-y-4">

      {/* 1. Posicion global + Desafio comunitario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/dashboard/comunidad" className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tu posicion global</p>
            <p className="text-sm font-black text-foreground">#{myRank}</p>
          </div>
        </Link>

        {challenge ? (
          <Link href="/dashboard/challenges" className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{challenge.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full xp-bar rounded-full" style={{ width: `${challengePct}%` }} />
                </div>
                <span className="text-xs font-bold text-primary shrink-0">{challengePct}%</span>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard/challenges" className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors opacity-60">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Desafio comunitario</p>
              <p className="text-xs font-semibold text-foreground">Sin desafio activo</p>
            </div>
          </Link>
        )}
      </div>

      {/* 2. Buffs activos */}
      {buffs.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
            <Zap className="w-3 h-3" /> BUFFS ACTIVOS
          </span>
          {buffs.map((b, i) => (
            <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${b.color}`}>
              {b.icon}{b.label}
            </span>
          ))}
        </div>
      )}

      {/* 3. Mision diaria + calendario de racha */}
      <DailyBonusCard canClaim={canClaimBonus} streak={streak} nextClaimMs={msUntilNext} />

      {/* 4. Battle Pass */}
      <SeasonPassTrack seasonXp={seasonXp} seasonId={activeSeason?.id ?? null} seasonName={activeSeason?.name ?? null} claimedMilestones={claimedMilestones} />

      {/* 5. Quest tracker */}
      {activeMissions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              QUESTS EN PROGRESO
            </span>
            <Link href="/dashboard/missions" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {activeMissions.map((m: any) => {
              const pct = m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground font-medium truncate flex-1 mr-2">{m.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{m.progress}/{m.target}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full xp-bar rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerta misiones por reclamar — junto a las quests */}
      {claimableCount > 0 && (
        <Link href="/dashboard/missions" className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[11px] font-black text-white shrink-0">
            {claimableCount}
          </span>
          {claimableCount === 1 ? 'Tenes 1 mision lista para reclamar' : `Tenes ${claimableCount} misiones listas para reclamar`} &rarr;
        </Link>
      )}

    </div>
  )

  return (
    <>
      {showOnboarding && (
        <OnboardingModal username={profile.username} avatarUrl={profile.avatar_url} />
      )}
      <DashboardClient
        initialProfile={profile}
        initialEvents={activityRes.data ?? []}
        initialMissions={missionsRes.data ?? []}
        userId={user.id}
        allBadges={allBadges}
        earnedBadgeIds={[...earnedIds]}
        myRank={myRank}
        middleContent={middleContent}
      />
    </>
  )
}
