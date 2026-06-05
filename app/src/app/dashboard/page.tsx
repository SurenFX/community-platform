import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import HonorTable from '@/components/dashboard/HonorTable'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, activityRes, missionsRes, allBadgesRes, earnedBadgesRes, honorRes] = await Promise.all([
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
    supabase
      .from('user_reputation')
      .select('user_id, weekly_xp, level, current_streak, profiles!inner(username, avatar_url)')
      .order('weekly_xp', { ascending: false })
      .gt('weekly_xp', 0)
      .limit(3),
  ])

  const profile        = profileRes.data
  const showOnboarding = profile && !(profile as any).onboarding_completed
  const earnedIds      = new Set((earnedBadgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges      = allBadgesRes.data ?? []
  const honorMembers   = (honorRes.data ?? []) as any[]

  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          username={profile.username}
          avatarUrl={profile.avatar_url}
        />
      )}
      <DashboardClient
        initialProfile={profile}
        initialEvents={activityRes.data ?? []}
        initialMissions={missionsRes.data ?? []}
        userId={user.id}
        allBadges={allBadges}
        earnedBadgeIds={[...earnedIds]}
      />
      {honorMembers.length > 0 && (
        <div className="mt-8">
          <HonorTable members={honorMembers} currentUserId={user.id} />
        </div>
      )}
    </>
  )
}
