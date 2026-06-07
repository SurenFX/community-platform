import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import SeasonCountdown from '@/components/layout/SeasonCountdown'

export default async function ComunidadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: entries } = await supabase
    .from('user_reputation')
    .select('user_id, total_xp, weekly_xp, monthly_xp, level, current_streak, profiles!inner(username, avatar_url, equipped_border_color, equipped_name_emoji, equipped_title_override)')
    .order('total_xp', { ascending: false })
    .limit(50)

  const { data: activeSeason } = await admin
    .from('seasons')
    .select('id, name, starts_at, ends_at')
    .eq('status', 'ACTIVE')
    .maybeSingle()

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
        <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
        <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos de la comunidad</p>
      </div>

      {/* Season banner */}
      {activeSeason && (
        <SeasonCountdown endsAt={activeSeason.ends_at} name={activeSeason.name} />
      )}

      <LeaderboardTable
        entries={(entries ?? []) as any}
        currentUserId={user.id}
        myRank={myRank}
        seasonName={activeSeason?.name ?? null}
      />
    </div>
  )
}
