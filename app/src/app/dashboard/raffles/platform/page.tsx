export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import PlatformRaffleClient from '@/components/raffles/PlatformRaffle'

export default async function PlatformRafflePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin client para bypassear RLS en raffles y raffle_pools
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [rafflesRes, repRes, myPoolRes] = await Promise.all([
    admin.from('raffles').select('*').eq('status', 'ACTIVE').order('ends_at'),
    admin.from('user_reputation').select('raffle_tickets, level, total_xp')
      .eq('user_id', user.id).single(),
    admin.from('raffle_pools').select('raffle_id, tickets').eq('user_id', user.id),
  ])

  const raffles   = (rafflesRes.data  ?? []) as any[]
  const rep       = repRes.data       as any
  const myPools   = (myPoolRes.data   ?? []) as any[]
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
