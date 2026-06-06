import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { CircleDollarSign, CheckCircle, Ticket } from 'lucide-react'

function timeAgo(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30)  return `hace ${d}d`
  return `hace ${Math.floor(d / 30)}m`
}

export default async function CoinsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [repRes, missionsRes, rafflePoolsRes] = await Promise.all([
    admin
      .from('user_reputation')
      .select('salchi_coins')
      .eq('user_id', user.id)
      .single(),
    // Misiones completadas con SC
    admin
      .from('user_missions')
      .select('completed_at, missions!inner(title, coin_reward)')
      .eq('user_id', user.id)
      .eq('is_claimed', true)
      .gt('missions.coin_reward', 0)
      .order('completed_at', { ascending: false })
      .limit(50),
    // Tickets gastados en sorteos
    admin
      .from('raffle_pools')
      .select('tickets, created_at, raffles!inner(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const balance = (repRes.data as any)?.salchi_coins ?? 0

  // Fusionar y ordenar cronológicamente: ganancias (+) y gastos (−)
  type TxItem = { date: string; label: string; amount: number; icon: 'earn' | 'spend' }

  const earned: TxItem[] = ((missionsRes.data ?? []) as any[]).map((m: any) => ({
    date:   m.completed_at,
    label:  m.missions?.title ?? 'Misión completada',
    amount: m.missions?.coin_reward ?? 0,
    icon:   'earn' as const,
  }))

  const spent: TxItem[] = ((rafflePoolsRes.data ?? []) as any[]).map((p: any) => ({
    date:   p.created_at,
    label:  `Participación en "${p.raffles?.title ?? 'sorteo'}"`,
    amount: p.tickets,
    icon:   'spend' as const,
  }))

  const all = [...earned, ...spent].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SalchiCoins</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tu historial de monedas</p>
      </div>

      {/* Balance actual */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 flex items-center justify-center shrink-0">
          <CircleDollarSign className="w-7 h-7 text-yellow-400" />
        </div>
        <div>
          <p className="text-3xl font-black text-foreground">{balance.toLocaleString('es-AR')}</p>
          <p className="text-sm text-muted-foreground">SC disponibles</p>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Historial</h2>
        </div>

        {all.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <CircleDollarSign className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
            <p className="text-foreground font-semibold mb-1">Sin transacciones aún</p>
            <p className="text-sm text-muted-foreground">Completá misiones para ganar SC.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {all.map((tx, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                {/* Icono */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  tx.icon === 'earn' ? 'bg-green-400/10' : 'bg-orange-400/10'
                }`}>
                  {tx.icon === 'earn'
                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : <Ticket className="w-4 h-4 text-orange-400" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.label}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(tx.date)}</p>
                </div>

                {/* Cantidad */}
                <span className={`text-sm font-bold shrink-0 ${
                  tx.icon === 'earn' ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {tx.icon === 'earn' ? '+' : '−'}{tx.amount} SC
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
