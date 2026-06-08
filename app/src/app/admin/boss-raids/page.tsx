import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BossRaidAdminClient from './BossRaidAdminClient'

export const revalidate = 30

export default async function BossRaidAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!(profile as any)?.is_admin) redirect('/dashboard')

  const { data: raids } = await admin
    .from('boss_raids')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return <BossRaidAdminClient raids={(raids ?? []) as any} />
}
