import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MissionsClient from './MissionsClient'

export default async function MissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  const { data: missionsRaw } = await supabase
    .from('missions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('type')

  const { data: userMissionsRaw } = await supabase
    .from('user_missions')
    .select('*')
    .eq('user_id', user.id)

  return (
    <MissionsClient
      missions={(missionsRaw ?? []) as any}
      userMissions={(userMissionsRaw ?? []) as any}
      userId={user.id}
    />
  )
}
