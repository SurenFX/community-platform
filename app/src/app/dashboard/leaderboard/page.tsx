import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('user_reputation')
    .select('user_id, total_xp, weekly_xp, monthly_xp, level, profiles!inner(username, avatar_url)')
    .order('total_xp', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos de la comunidad</p>
      </div>

      <LeaderboardTable
        entries={(entries ?? []) as any}
        currentUserId={user.id}
      />
    </div>
  )
}
