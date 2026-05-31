import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminRafflesClient from '@/components/admin/AdminRaffles'

export default async function AdminRafflesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raffles } = await supabase
    .from('raffles')
    .select('*')
    .order('created_at', { ascending: false }) as any

  // Contar participantes por sorteo
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sorteos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gestioná los sorteos de la plataforma</p>
      </div>
      <AdminRafflesClient raffles={raffles ?? []} poolMap={poolMap} />
    </div>
  )
}
