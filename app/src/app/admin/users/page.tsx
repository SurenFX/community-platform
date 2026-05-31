import { createClient } from '@/lib/supabase/server'
import UsersTable from '@/components/admin/UsersTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select(`
      id, username, discord_tag, avatar_url, is_admin, is_banned, created_at,
      user_reputation(total_xp, level, current_streak),
      user_social_links(platform)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {users?.length ?? 0} usuarios registrados
        </p>
      </div>
      <UsersTable users={users ?? []} />
    </div>
  )
}
