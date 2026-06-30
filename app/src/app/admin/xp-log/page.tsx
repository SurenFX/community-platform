import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Activity } from 'lucide-react'
import XpLogClient from './XpLogClient'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function AdminXpLogPage() {
  const db = admin()

  const { data: events } = await db
    .from('xp_events')
    .select('id, user_id, event_type, xp_awarded, platform, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch usernames para los eventos iniciales
  const userIds = [...new Set((events ?? []).map((e: any) => e.user_id))]
  const { data: profiles } = userIds.length
    ? await db.from('profiles').select('id, username').in('id', userIds)
    : { data: [] }

  const usernameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]))

  const initialEvents = (events ?? []).map((e: any) => ({
    ...e,
    username: usernameMap.get(e.user_id) ?? '—',
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> Log de XP en vivo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Eventos de XP en tiempo real. Se actualiza automáticamente.
        </p>
      </div>

      <XpLogClient initialEvents={initialEvents} />
    </div>
  )
}
