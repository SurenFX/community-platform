import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import SpinWheelClient from './SpinWheelClient'

export default async function RuedaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [prizesRes, repRes, historyRes] = await Promise.all([
    admin.from('spin_wheel_prizes').select('*').order('sort_order'),
    admin.from('user_reputation').select('salchi_coins').eq('user_id', user.id).single(),
    admin.from('spin_wheel_history')
      .select('id, prize_snapshot, cost_sc, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <SpinWheelClient
      prizes={(prizesRes.data ?? []) as any}
      balance={(repRes.data as any)?.salchi_coins ?? 0}
      history={(historyRes.data ?? []) as any}
    />
  )
}
