import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AmigosAdminClient from './AmigosAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminAmigosPage() {
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

  const { data: friends } = await admin
    .from('friend_streamers')
    .select('*')
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Amigos streamers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cuando enciendan en Kick o Twitch, el bot avisa automáticamente en el canal de Discord
        </p>
      </div>
      <AmigosAdminClient friends={(friends ?? []) as any} />
    </div>
  )
}
