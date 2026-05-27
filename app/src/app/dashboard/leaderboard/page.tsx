import { createClient } from '@/lib/supabase/server'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'

export const revalidate = 30 // revalidar cada 30 segundos

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data: entries } = await supabase
    .from('user_reputation')
    .select(`
      user_id,
      total_xp,
      weekly_xp,
      monthly_xp,
      level,
      profiles!inner (username, avatar_url)
    `)
    .order('total_xp', { ascending: false })
    .limit(100)

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">
          Los miembros más activos de la comunidad
        </p>
      </div>
      <LeaderboardTable
        entries={entries ?? []}
        currentUserId={user?.id}
      />
    </div>
  )
}
