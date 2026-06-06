import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'

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

  // Season banner data
  const seasonDaysLeft = activeSeason
    ? Math.max(0, Math.ceil((new Date(activeSeason.ends_at).getTime() - Date.now()) / 86_400_000))
    : null

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
        <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos de la comunidad</p>
      </div>

      {/* Season banner */}
      {activeSeason && (
        <div className="relative overflow-hidden bg-card border border-primary/20 rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, hsl(185 100% 45% / 0.08) 0%, transparent 60%)' }}
        >
          <div className="text-2xl">🏆</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Temporada activa</p>
            <p className="text-base font-black text-foreground">{activeSeason.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black text-foreground">{seasonDaysLeft}</p>
            <p className="text-xs text-muted-foreground">días restantes</p>
          </div>
        </div>
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
