export const dynamic = 'force-dynamic'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Ticket, ChevronLeft } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

export default async function RaffleHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: drawnRaffles } = await admin
    .from('raffles')
    .select('id, title, prize, description, ends_at, winner_id')
    .eq('status', 'DRAWN')
    .order('ends_at', { ascending: false })
    .limit(20)

  // Obtener usernames de los ganadores
  const winnerIds = [...new Set((drawnRaffles ?? []).map((r: any) => r.winner_id).filter(Boolean))]
  const { data: winnerProfiles } = winnerIds.length > 0
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', winnerIds)
    : { data: [] }

  const winnerMap = new Map((winnerProfiles ?? []).map((p: any) => [p.id, p]))

  // Participación del usuario actual
  const { data: myParticipations } = await admin
    .from('raffle_pools')
    .select('raffle_id, tickets')
    .eq('user_id', user.id)
  const myParticipationMap = new Map((myParticipations ?? []).map((p: any) => [p.raffle_id, p.tickets]))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/raffles" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de sorteos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Sorteos anteriores y sus ganadores</p>
        </div>
      </div>

      {(!drawnRaffles || drawnRaffles.length === 0) ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">Sin sorteos anteriores</p>
          <p className="text-sm text-muted-foreground">Los sorteos finalizados aparecerán acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drawnRaffles.map((raffle: any) => {
            const winner   = winnerMap.get(raffle.winner_id)
            const isWinner = raffle.winner_id === user.id
            const myTickets = myParticipationMap.get(raffle.id) ?? 0

            return (
              <div key={raffle.id}
                className={`bg-card border rounded-2xl p-5 ${isWinner ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isWinner && (
                        <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full">
                          🏆 ¡Ganaste!
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{raffle.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{raffle.prize}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(raffle.ends_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  {/* Ganador */}
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                    {winner ? (
                      <div className="flex items-center gap-2">
                        {winner.avatar_url ? (
                          <img src={winner.avatar_url} alt={winner.username}
                            className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary">
                              {winner.username?.[0]?.toUpperCase()}
                            </span>
                          </div>
                        )}
                        <Link
                          href={`/dashboard/profile/${winner.username}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {winner.username}
                        </Link>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin ganador registrado</span>
                    )}
                  </div>

                  {/* Mi participación */}
                  {myTickets > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Ticket className="w-3.5 h-3.5" />
                      {myTickets} ticket{myTickets !== 1 ? 's' : ''} usados
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
