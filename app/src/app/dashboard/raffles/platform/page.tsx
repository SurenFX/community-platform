import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlatformRaffleClient from '@/components/raffles/PlatformRaffle'

export default async function PlatformRafflePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [rafflesRes, repRes, myPoolRes] = await Promise.all([
    supabase.from('raffles').select('*').eq('status', 'ACTIVE')
      .lte('starts_at', new Date().toISOString()).order('ends_at') as any,
    supabase.from('user_reputation').select('raffle_tickets, level, total_xp')
      .eq('user_id', user.id).single() as any,
    supabase.from('raffle_pools').select('raffle_id, tickets').eq('user_id', user.id) as any,
  ])

  const raffles   = rafflesRes.data  ?? []
  const rep       = repRes.data
  const myPools   = myPoolRes.data   ?? []
  const myTickets = rep?.raffle_tickets ?? 0

  return (
    <PlatformRaffleClient
      raffles={raffles}
      myTickets={myTickets}
      myLevel={rep?.level ?? 1}
      myXp={rep?.total_xp ?? 0}
      myPools={myPools}
      userId={user.id}
    />
  )
}
