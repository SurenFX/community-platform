import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'

export default async function ComunidadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('user_reputation')
    .select('user_id, total_xp, weekly_xp, monthly_xp, level, current_streak, profiles!inner(username, avatar_url)')
    .order('total_xp', { ascending: false })
    .limit(50)

  const { data: myRep } = await supabase
    .from('user_reputation')
    .select('total_xp, weekly_xp, monthly_xp')
    .eq('user_id', user.id)
    .single() as any as { data: { total_xp: number; weekly_xp: number; monthly_xp: number } | null }

  let myRank = null
  if (myRep) {
    const [rankTotal, rankWeekly, rankMonthly] = await Promise.all([
      supabase.from('user_reputation').select('*', { count: 'exact', head: true }).gt('total_xp',   myRep.total_xp),
      supabase.from('user_reputation').select('*', { count: 'exact', head: true }).gt('weekly_xp',  myRep.weekly_xp),
      supabase.from('user_reputation').select('*', { count: 'exact', head: true }).gt('monthly_xp', myRep.monthly_xp),
    ])
    myRank = {
      total_xp:    myRep.total_xp,
      weekly_xp:   myRep.weekly_xp,
      monthly_xp:  myRep.monthly_xp,
      rank_total:   (rankTotal.count  ?? 0) + 1,
      rank_weekly:  (rankWeekly.count ?? 0) + 1,
      rank_monthly: (rankMonthly.count ?? 0) + 1,
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunidad</h1>
        <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos</p>
      </div>
      <LeaderboardTable
        entries={(entries ?? []) as any}
        currentUserId={user.id}
        myRank={myRank}
      />
    </div>
  )
}
