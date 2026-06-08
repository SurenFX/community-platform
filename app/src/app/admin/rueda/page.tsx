import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RuedaAdminClient from './RuedaAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminRuedaPage() {
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

  const { data: prizes } = await admin
    .from('spin_wheel_prizes')
    .select('*')
    .order('sort_order')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rueda de la suerte</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gestion de premios disponibles en la rueda</p>
      </div>
      <RuedaAdminClient prizes={(prizes ?? []) as any} />
    </div>
  )
}
