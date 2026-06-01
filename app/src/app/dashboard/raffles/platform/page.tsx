export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import PlatformRaffleClient from '@/components/raffles/PlatformRaffle'
import { Trophy } from 'lucide-react'

export default async function PlatformRafflePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: allRaffles, error: rafflesError } = await admin
    .from('raffles')
    .select('id, title, status, ends_at, starts_at, prize, description, use_weighted, min_level, min_xp')
    .order('ends_at')

  // Debug: mostrar todos los sorteos para diagnosticar
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

  // Debug temporal — mostrar error si falla la query
  if (rafflesError) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-destructive/10 border border-destructive/20 rounded-xl">
        <p className="text-destructive font-mono text-sm">Error: {rafflesError.message}</p>
      </div>
    )
  }

  // Debug panel
  if (!allRaffles?.length) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-secondary rounded-xl space-y-2">
        <p className="text-sm font-bold">Debug: query OK, 0 sorteos encontrados en total</p>
        {rafflesError && <p className="text-destructive text-xs">Error: {(rafflesError as any).message}</p>}
      </div>
    )
  }

  return (
    <PlatformRaffleClient
      raffles={(raffles ?? []) as any}
      myTickets={rep?.raffle_tickets ?? 0}
      myLevel={rep?.level ?? 1}
      myXp={rep?.total_xp ?? 0}
      myPools={(myPools ?? []) as any}
      userId={user.id}
    />
  )
}
