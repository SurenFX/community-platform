import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import MissionsClient from './MissionsClient'

export const revalidate = 60

export default async function MissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const now = new Date().toISOString()

  const [activeMissionsRes, userMissionsRes, streamStatusRes] = await Promise.all([
    supabase
      .from('missions')
      .select('*')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('type'),
    supabase
      .from('user_missions')
      .select('*')
      .eq('user_id', user.id),
    admin
      .from('stream_status')
      .select('is_live')
      .eq('id', 1)
      .single(),
  ])

  const activeMissionsRaw = activeMissionsRes.data ?? []
  const userMissionsRaw   = userMissionsRes.data ?? []
  const isStreamLive      = (streamStatusRes.data as any)?.is_live ?? false

  // Misiones de stream: solo se muestran cuando el stream esta en vivo
  // Cuando no esta en vivo, las filtramos de las activas pero las pasamos aparte
  const streamMissions = activeMissionsRaw.filter((m: any) => m.is_stream_only)
  const regularMissions = activeMissionsRaw.filter((m: any) => !m.is_stream_only)

  // Misiones expiradas sin reclamar
  const activeMissionIds = activeMissionsRaw.map((m: any) => m.id)
  const unclaimedExpiredUMs = userMissionsRaw.filter(
    (um: any) => um.is_completed && !um.is_claimed && !activeMissionIds.includes(um.mission_id)
  )
  let expiredMissionsRaw: any[] = []
  if (unclaimedExpiredUMs.length > 0) {
    const expiredIds = unclaimedExpiredUMs.map((um: any) => um.mission_id)
    const { data } = await supabase.from('missions').select('*').in('id', expiredIds)
    expiredMissionsRaw = (data ?? []).map((m: any) => ({ ...m, _expired_unclaimed: true }))
  }

  // Activas: regulares siempre + stream solo si live
  const visibleMissions = [
    ...regularMissions,
    ...(isStreamLive ? streamMissions : []),
    ...expiredMissionsRaw,
  ]

  return (
    <MissionsClient
      missions={visibleMissions as any}
      userMissions={userMissionsRaw as any}
      userId={user.id}
      isStreamLive={isStreamLive}
      streamMissions={streamMissions as any}
    />
  )
}
