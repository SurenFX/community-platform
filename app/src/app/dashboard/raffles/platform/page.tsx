export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import PlatformRaffleClient from '@/components/raffles/PlatformRaffle'
import { Ticket, History } from 'lucide-react'
import Link from 'next/link'

export default async function PlatformRafflePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: allRaffles } = await admin
    .from('raffles')
    .select('id, title, status, ends_at, starts_at, prize, description, use_weighted, min_level, min_xp')
    .order('ends_at')

  const raffles = allRaffles?.filter((r: any) => r.status === 'ACTIVE') ?? []

  const { data: repData } = await admin
    .from('user_reputation')
    .select('raffle_tickets, level, total_xp')
    .eq('user_id', user.id)
    .single()

  const { data: myPools } = await admin
    .from('raffle_pools')
    .select('raffle_id, tickets')
    .eq('user_id', user.id)

  const rep = repData as any

  const header = (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sorteos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Usá tus tickets para participar en sorteos exclusivos</p>
      </div>
      <Link href="/dashboard/raffles/history"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border px-3 py-2 rounded-lg transition-all">
        <History className="w-3.5 h-3.5" />
        Historial
      </Link>
    </div>
  )

  if (!raffles.length) {
    return (
      <div className="max-w-2xl mx-auto">
        {header}
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">No hay sorteos activos</p>
          <p className="text-sm text-muted-foreground">Seguí acumulando tickets — pronto habrá nuevos sorteos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {header}
      <PlatformRaffleClient
        raffles={raffles as any}
        myTickets={rep?.raffle_tickets ?? 0}
        myLevel={rep?.level ?? 1}
        myXp={rep?.total_xp ?? 0}
        myPools={(myPools ?? []) as any}
        userId={user.id}
      />
    </div>
  )
}
