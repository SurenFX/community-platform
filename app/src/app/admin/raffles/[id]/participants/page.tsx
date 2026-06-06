import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Ticket, Users, Trophy } from 'lucide-react'

function timeAgo(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30)  return `hace ${d}d`
  return `hace ${Math.floor(d / 30)}m`
}

export default async function RaffleParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!adminProfile?.is_admin) redirect('/dashboard')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [raffleRes, poolRes] = await Promise.all([
    admin.from('raffles').select('id, title, prize, status, ends_at, winner_id').eq('id', id).single(),
    admin.from('raffle_pools').select('user_id, tickets, created_at').eq('raffle_id', id).order('tickets', { ascending: false }),
  ])

  if (!raffleRes.data) notFound()

  const raffle = raffleRes.data as any
  const pool   = (poolRes.data ?? []) as any[]

  // Fetch profiles for all participants
  const userIds = pool.map((p: any) => p.user_id)
  const { data: profiles } = userIds.length > 0
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', userIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  const totalTickets = pool.reduce((sum: number, p: any) => sum + p.tickets, 0)

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE:    'bg-green-400/15 text-green-400',
    DRAWN:     'bg-blue-400/15 text-blue-400',
    PENDING:   'bg-yellow-400/15 text-yellow-400',
    CANCELLED: 'bg-destructive/15 text-destructive',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link href="/admin/raffles" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <span className="text-sm text-muted-foreground">
          Sorteos / <span className="text-foreground font-medium">{raffle.title}</span>
        </span>
      </div>

      {/* Info sorteo */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[raffle.status] ?? ''}`}>
                {raffle.status}
              </span>
            </div>
            <h1 className="text-lg font-bold text-foreground">{raffle.title}</h1>
            <p className="text-sm text-muted-foreground">🎁 {raffle.prize}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xl font-black text-foreground">{pool.length}</p>
            <p className="text-xs text-muted-foreground">Participantes</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-foreground">{totalTickets}</p>
            <p className="text-xs text-muted-foreground">Tickets totales</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-foreground">
              {pool.length > 0 ? Math.round(totalTickets / pool.length * 10) / 10 : 0}
            </p>
            <p className="text-xs text-muted-foreground">Tickets promedio</p>
          </div>
        </div>
      </div>

      {/* Lista de participantes */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Participantes ({pool.length})
          </h2>
        </div>

        {pool.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Ticket className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
            <p className="text-foreground font-semibold mb-1">Sin participantes aún</p>
            <p className="text-sm text-muted-foreground">Nadie ha apostado tickets en este sorteo todavía.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pool.map((entry: any, i: number) => {
              const profile = profileMap.get(entry.user_id)
              const pct     = totalTickets > 0 ? ((entry.tickets / totalTickets) * 100).toFixed(1) : '0'
              const isWinner = raffle.winner_id === entry.user_id

              return (
                <div key={entry.user_id} className={`flex items-center gap-4 px-5 py-3.5 ${isWinner ? 'bg-yellow-400/5 border-l-2 border-yellow-400' : ''}`}>
                  {/* Rank */}
                  <span className="text-sm font-bold text-muted-foreground w-6 text-center shrink-0">{i + 1}</span>

                  {/* Avatar */}
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username}
                      className="w-8 h-8 rounded-full shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(profile?.username ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {profile?.username ? (
                        <Link
                          href={`/admin/users/${entry.user_id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {profile.username}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">Usuario eliminado</span>
                      )}
                      {isWinner && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                          <Trophy className="w-3 h-3" /> Ganador
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
                  </div>

                  {/* Tickets + porcentaje */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground flex items-center gap-1 justify-end">
                      <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                      {entry.tickets}
                    </p>
                    <p className="text-xs text-muted-foreground">{pct}% chances</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
