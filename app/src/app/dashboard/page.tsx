import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, activityRes, missionsRes] = await Promise.all([
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
  ])

  return (
    <DashboardClient
      initialProfile={profileRes.data}
      initialEvents={activityRes.data ?? []}
      initialMissions={missionsRes.data ?? []}
      userId={user.id}
    />
  )
}
