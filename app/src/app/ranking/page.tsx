import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'

export const metadata: Metadata = {
  title: 'Ranking — SalchiNeta',
  description: 'Los miembros más activos de la comunidad SalchiNeta',
}

export const revalidate = 60 // cache 1 minuto

export default async function PublicRankingPage() {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: entries } = await supabase
    .from('user_reputation')
    .select('user_id, total_xp, weekly_xp, monthly_xp, level, current_streak, profiles!inner(username, avatar_url)')
    .order('total_xp', { ascending: false })
    .limit(50)

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

      {/* Contenido */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
          <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos de la comunidad</p>
        </div>

        <LeaderboardTable
          entries={(entries ?? []) as any}
        />

        {/* CTA para unirse */}
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
