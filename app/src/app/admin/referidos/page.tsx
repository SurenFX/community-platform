import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReferidosAdminClient from './ReferidosAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminReferidosPage() {
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

  const { data: links } = await admin
    .from('referral_links')
    .select('*')
    .order('sort_order')
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referidos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gestioná los links de referido por juego que se muestran a la comunidad
        </p>
      </div>
      <ReferidosAdminClient links={(links ?? []) as any} />
    </div>
  )
}
