import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReferidosClient from './ReferidosClient'

export const dynamic = 'force-dynamic'

export default async function ReferidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: links } = await admin
    .from('referral_links')
    .select('id, game_name, game_image_url, referral_url, description, hide_name')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Juegos recomendados</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Regístrate en estos juegos usando el link de Salchi y apoyá al stream
        </p>
      </div>
      <ReferidosClient links={(links ?? []) as any} />
    </div>
  )
}
