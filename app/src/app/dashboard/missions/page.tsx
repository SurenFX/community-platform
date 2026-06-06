import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MissionsClient from './MissionsClient'

export default async function MissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  // Misiones activas (no expiradas)
  const { data: activeMissionsRaw } = await supabase
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

  // Misiones expiradas sin reclamar — para mostrarlas como "Expiradas" en Completadas
  const activeMissionIds = (activeMissionsRaw ?? []).map((m: any) => m.id)
  const unclaimedExpiredUMs = (userMissionsRaw ?? []).filter(
    (um: any) => um.is_completed && !um.is_claimed && !activeMissionIds.includes(um.mission_id)
  )
  let expiredMissionsRaw: any[] = []
  if (unclaimedExpiredUMs.length > 0) {
    const expiredIds = unclaimedExpiredUMs.map((um: any) => um.mission_id)
    const { data } = await supabase.from('missions').select('*').in('id', expiredIds)
    expiredMissionsRaw = (data ?? []).map((m: any) => ({ ...m, _expired_unclaimed: true }))
  }

  const missionsRaw = [...(activeMissionsRaw ?? []), ...expiredMissionsRaw]

  return (
    <MissionsClient
      missions={(missionsRaw ?? []) as any}
      userMissions={(userMissionsRaw ?? []) as any}
      userId={user.id}
    />
  )
}
