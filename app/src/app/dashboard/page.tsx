import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import LiveStreamBanner from '@/components/dashboard/LiveStreamBanner'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, activityRes, missionsRes, allBadgesRes, earnedBadgesRes, streamConfigRes] = await Promise.all([
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
      .limit(10),
    supabase
      .from('user_missions')
      .select('*, missions(*)')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .limit(3),
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
      .from('platform_config')
      .select('key, value')
      .in('key', ['stream_is_live', 'stream_title', 'stream_game']),
  ])

  const profile        = profileRes.data
  const showOnboarding = profile && !(profile as any).onboarding_completed
  const earnedIds      = new Set((earnedBadgesRes.data ?? []).map((b: any) => b.badge_id))
  const allBadges      = allBadgesRes.data ?? []

  const streamConfig   = Object.fromEntries((streamConfigRes.data ?? []).map((c: any) => [c.key, c.value]))
  const isLive         = streamConfig['stream_is_live'] === 'true'
  const streamTitle    = streamConfig['stream_title'] ?? ''
  const streamGame     = streamConfig['stream_game'] ?? ''
  const twitchChannel  = process.env.NEXT_PUBLIC_TWITCH_CHANNEL ?? 'salchinft'

  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          username={profile.username}
          avatarUrl={profile.avatar_url}
        />
      )}
      {isLive && (
        <div className="mb-6">
          <LiveStreamBanner
            initialIsLive={isLive}
            initialTitle={streamTitle}
            initialGame={streamGame}
            twitchChannel={twitchChannel}
          />
        </div>
      )}
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
