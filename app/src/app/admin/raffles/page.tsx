import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Youtube, Tv } from 'lucide-react'
import AdminRafflesClient from '@/components/admin/AdminRaffles'

export default async function AdminRafflesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raffles } = await supabase
    .from('raffles')
    .select('*')
    .order('created_at', { ascending: false }) as any

  const { data: pools } = await supabase
    .from('raffle_pools')
    .select('raffle_id, tickets') as any

  const poolMap: Record<string, { entries: number; totalTickets: number }> = {}
  for (const p of pools ?? []) {
    if (!poolMap[p.raffle_id]) poolMap[p.raffle_id] = { entries: 0, totalTickets: 0 }
    poolMap[p.raffle_id].entries++
    poolMap[p.raffle_id].totalTickets += p.tickets
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sorteos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gestioná todos los tipos de sorteos</p>
      </div>

      {/* Sorteos en vivo — YouTube y Twitch */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sorteos en vivo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/raffles/youtube"
            className="bg-card border border-red-400/20 hover:border-red-400/50 rounded-2xl p-6 transition-all space-y-4 block">
            <div className="w-12 h-12 rounded-xl bg-red-400/10 flex items-center justify-center">
              <Youtube className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Sorteo en YouTube</h3>
              <p className="text-sm text-muted-foreground">Sorteá entre los comentarios de cualquier video del canal</p>
            </div>
          </Link>

          <Link href="/dashboard/raffles/twitch"
            className="bg-card border border-purple-400/20 hover:border-purple-400/50 rounded-2xl p-6 transition-all space-y-4 block">
            <div className="w-12 h-12 rounded-xl bg-purple-400/10 flex items-center justify-center">
              <Tv className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Sorteo en Twitch</h3>
              <p className="text-sm text-muted-foreground">Los viewers escriben una keyword en el chat para participar</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Sorteos de plataforma con tickets */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sorteos de plataforma</h2>
        <AdminRafflesClient raffles={raffles ?? []} poolMap={poolMap} />
      </div>
    </div>
  )
}
