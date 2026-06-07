import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Swords, MapPin } from 'lucide-react'
import DashboardClient from '@/components/dashboard/DashboardClient'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import DailyBonusCard from '@/components/dashboard/DailyBonusCard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [profileRes, activityRes, missionsRes, claimableRes, allBadgesRes, earnedBadgesRes, challengeRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, user_reputation(*), user_badges(*, badges(*))')
      .eq('id', user.id)
      .single(),
    supabase
      .from('xp_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('user_missions')
      .select('*, missions(*)')
      .eq('user_id', user.id)
      .eq('is_completed', false),
    supabase
      .from('user_missions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .eq('is_claimed', false),
    supabase
      .from('badges')
      .select('id, slug, name, description, image_url, tier, family, family_order')
      .eq('is_secret', false)
      .not('family', 'is', null)
      .order('family')
      .order('family_order'),
    supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', user.id),
    // Desafío comunitario activo
    admin
      .from('community_challenges')
      .select('id, title, goal_xp, starts_at, ends_at, reward_xp_per_user, reward_sc_per_user')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profile        = profileRes.data
  const showOnboarding = profile && !(profile as any).onboarding_completed
  const earnedIds      = new Set((earnedBadgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges      = allBadgesRes.data ?? []
  const claimableCount = claimableRes.count ?? 0
  const challenge      = (challengeRes as any).data

  // Progreso del desafío activo desde xp_events
  let challengePct = 0
  if (challenge) {
    const { data: evts } = await admin
      .from('xp_events')
      .select('xp_awarded')
      .gte('created_at', challenge.starts_at)
      .lte('created_at', challenge.ends_at)
    const total = ((evts ?? []) as any[]).reduce((s: number, e: any) => s + (e.xp_awarded ?? 0), 0)
    challengePct = challenge.goal_xp > 0 ? Math.min(100, Math.round((total / challenge.goal_xp) * 100)) : 0
  }

  // Posición en ranking (usuarios con más XP que yo + 1)
  const myTotalXp = (profile as any)?.user_reputation?.total_xp ?? 0
  const { count: usersAhead } = await supabase
    .from('user_reputation')
    .select('*', { count: 'exact', head: true })
    .gt('total_xp', myTotalXp)
  const myRank = (usersAhead ?? 0) + 1

  // Daily bonus — resetea a las 00:00 UTC cada día
  const lastBonusAt  = (profile as any)?.user_reputation?.last_daily_bonus_at ?? null
  const nowMs        = Date.now()
  const todayUTC     = new Date().toISOString().slice(0, 10)
  const lastBonusDay = lastBonusAt ? (lastBonusAt as string).slice(0, 10) : null
  const claimedToday = lastBonusDay === todayUTC
  // Tiempo hasta el próximo 00:00 UTC
  const nextMidnightUTC = new Date(todayUTC + 'T00:00:00Z').getTime() + 86_400_000
  const msUntilNext  = claimedToday ? Math.max(0, nextMidnightUTC - nowMs) : 0
  const canClaimBonus = !claimedToday
  const streak = (profile as any)?.user_reputation?.current_streak ?? 0

  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          username={profile.username}
          avatarUrl={profile.avatar_url}
        />
      )}
      {claimableCount > 0 && (
        <Link href="/dashboard/missions" className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[11px] font-black text-white shrink-0">
            {claimableCount}
          </span>
          {claimableCount === 1 ? 'Tenés 1 misión lista para reclamar' : `Tenés ${claimableCount} misiones listas para reclamar`} →
        </Link>
      )}
      <div className="mb-4">
        <DailyBonusCard canClaim={canClaimBonus} streak={streak} nextClaimMs={msUntilNext} />
      </div>

      {/* Fila: posición en ranking + desafío activo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Posición global */}
        <Link href="/dashboard/comunidad"
          className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tu posición global</p>
            <p className="text-sm font-black text-foreground">#{myRank}</p>
          </div>
        </Link>

        {/* Desafío activo */}
        {challenge ? (() => {
          const pct = challengePct
          return (
            <Link href="/dashboard/challenges"
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Swords className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{challenge.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full xp-bar rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">{pct}%</span>
                </div>
              </div>
            </Link>
          )
        })() : (
          <Link href="/dashboard/challenges"
            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors opacity-60">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Swords className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Desafío comunitario</p>
              <p className="text-xs font-semibold text-foreground">Sin desafío activo</p>
            </div>
          </Link>
        )}
      </div>
      <DashboardClient
        initialProfile={profile}
        initialEvents={activityRes.data ?? []}
        initialMissions={missionsRes.data ?? []}
        userId={user.id}
        allBadges={allBadges}
        earnedBadgeIds={[...earnedIds]}
        myRank={myRank}
      />
    </>
  )
}
