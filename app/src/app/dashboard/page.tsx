import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardClient from '@/components/dashboard/DashboardClient'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import DailyBonusCard from '@/components/dashboard/DailyBonusCard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, activityRes, missionsRes, claimableRes, allBadgesRes, earnedBadgesRes] = await Promise.all([
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
  ])

  const profile        = profileRes.data
  const showOnboarding = profile && !(profile as any).onboarding_completed
  const earnedIds      = new Set((earnedBadgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges      = allBadgesRes.data ?? []
  const claimableCount = claimableRes.count ?? 0

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
        <Link href="/dashboard/misiones" className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition-colors">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[11px] font-black text-white shrink-0">
            {claimableCount}
          </span>
          {claimableCount === 1 ? 'Tenés 1 misión lista para reclamar' : `Tenés ${claimableCount} misiones listas para reclamar`} →
        </Link>
      )}
      <div className="mb-4">
        <DailyBonusCard canClaim={canClaimBonus} streak={streak} nextClaimMs={msUntilNext} />
      </div>
      <DashboardClient
        initialProfile={profile}
        initialEvents={activityRes.data ?? []}
        initialMissions={missionsRes.data ?? []}
        userId={user.id}
        allBadges={allBadges}
        earnedBadgeIds={[...earnedIds]}
      />
    </>
  )
}
