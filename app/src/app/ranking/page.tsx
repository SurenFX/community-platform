import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import SeasonCountdown from '@/components/layout/SeasonCountdown'
import { Trophy, Medal, User } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Ranking — SalchiNeta',
  description: 'Los miembros más activos de la comunidad SalchiNeta',
}

export const revalidate = 60

export default async function PublicRankingPage() {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: entries }, { data: activeSeason }, { data: closedSeasons }] = await Promise.all([
    supabase
      .from('user_reputation')
      .select('user_id, total_xp, weekly_xp, monthly_xp, level, current_streak, profiles!inner(username, avatar_url, equipped_border_color, equipped_name_emoji, equipped_title_override)')
      .order('total_xp', { ascending: false })
      .limit(50),
    supabase
      .from('seasons')
      .select('id, name, ends_at')
      .eq('status', 'ACTIVE')
      .maybeSingle(),
    supabase
      .from('seasons')
      .select('id, name, starts_at, ends_at')
      .eq('status', 'CLOSED')
      .order('ends_at', { ascending: false })
      .limit(10),
  ])

  // Para cada temporada cerrada, obtener top 3 por monthly_xp en ese período
  const seasonHistories: Array<{
    season: { id: string; name: string; starts_at: string; ends_at: string }
    top3:   Array<{ username: string; avatar_url: string | null; xp: number; rank: number }>
  }> = []

  for (const season of (closedSeasons ?? []) as any[]) {
    const { data: topUsers } = await supabase
      .from('xp_events')
      .select('user_id, xp_awarded')
      .gte('created_at', season.starts_at)
      .lte('created_at', season.ends_at)
      .limit(5000)

    if (!topUsers?.length) {
      seasonHistories.push({ season, top3: [] })
      continue
    }

    // Agrupar por user_id
    const xpMap: Record<string, number> = {}
    for (const e of topUsers as any[]) {
      xpMap[e.user_id] = (xpMap[e.user_id] ?? 0) + e.xp_awarded
    }

    const sorted = Object.entries(xpMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const userIds = sorted.map(([id]) => id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    const profileMap: Record<string, any> = {}
    for (const p of profiles ?? []) profileMap[(p as any).id] = p

    seasonHistories.push({
      season,
      top3: sorted.map(([userId, xp], i) => ({
        username:   profileMap[userId]?.username ?? '???',
        avatar_url: profileMap[userId]?.avatar_url ?? null,
        xp,
        rank: i + 1,
      })),
    })
  }

  const RANK_ICONS = [
    <Trophy key={1} className="w-4 h-4 text-yellow-400" />,
    <Medal  key={2} className="w-4 h-4 text-slate-400"  />,
    <Medal  key={3} className="w-4 h-4 text-amber-600"  />,
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar pública mínima */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌭</span>
            <span className="font-extrabold text-foreground tracking-tight text-sm">SalchiNeta</span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">BETA</span>
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-all"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
          <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos de la comunidad</p>
        </div>

        {activeSeason && (
          <SeasonCountdown endsAt={activeSeason.ends_at} name={activeSeason.name} />
        )}

        <LeaderboardTable
          entries={(entries ?? []) as any}
          seasonName={(activeSeason as any)?.name ?? null}
        />

        {/* Historial de temporadas */}
        {seasonHistories.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-foreground">Temporadas anteriores</h2>
            {seasonHistories.map(({ season, top3 }) => (
              <div key={season.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/20">
                  <p className="text-sm font-bold text-foreground">{season.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(season.ends_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {top3.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">Sin actividad registrada.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {top3.map((u, i) => (
                      <div key={u.username} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-6 flex justify-center shrink-0">
                          {RANK_ICONS[i]}
                        </div>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.username} className="w-7 h-7 rounded-full shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <p className="flex-1 text-sm font-semibold text-foreground truncate">{u.username}</p>
                        <p className="text-xs font-bold text-primary">{u.xp.toLocaleString('es-AR')} XP</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-foreground mb-1">¿Querés aparecer en el ranking?</p>
          <p className="text-xs text-muted-foreground mb-4">Uníte a la comunidad, ganá XP y escalá posiciones.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            Unirme ahora
          </Link>
        </div>
      </main>
    </div>
  )
}
