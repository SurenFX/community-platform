import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { CircleDollarSign, ShoppingBag, Flame, Swords, CheckCircle, Zap } from 'lucide-react'

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

  const [repRes, missionsRes, purchasesRes, notifRes] = await Promise.all([
    admin.from('user_reputation').select('salchi_coins').eq('user_id', user.id).single(),
    // SC ganados por misiones
    admin
      .from('user_missions')
      .select('completed_at, missions!inner(title, coin_reward)')
      .eq('user_id', user.id)
      .eq('is_claimed', true)
      .order('completed_at', { ascending: false })
      .limit(50),
    // SC gastados en tienda
    admin
      .from('user_inventory')
      .select('created_at, shop_items!inner(name, price_sc)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    // Notificaciones de SC (bono diario, challenge rewards, grants manuales)
    admin
      .from('notifications')
      .select('created_at, title, type')
      .eq('user_id', user.id)
      .in('type', ['SYSTEM', 'CHALLENGE_REWARD', 'STREAK_BONUS', 'MISSION_COMPLETED'])
      .ilike('title', '%SalchiCoin%')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const balance = (repRes.data as any)?.salchi_coins ?? 0

  type TxItem = { date: string; label: string; amount: number; type: 'earn' | 'spend'; source: string }

  const txs: TxItem[] = []

  // Misiones
  for (const m of (missionsRes.data ?? []) as any[]) {
    const sc = m.missions?.coin_reward ?? 0
    if (sc > 0) txs.push({ date: m.completed_at, label: m.missions?.title ?? 'Misión completada', amount: sc, type: 'earn', source: 'mission' })
  }

  // Compras
  for (const p of (purchasesRes.data ?? []) as any[]) {
    const sc = p.shop_items?.price_sc ?? 0
    if (sc > 0) txs.push({ date: p.created_at, label: p.shop_items?.name ?? 'Ítem de tienda', amount: sc, type: 'spend', source: 'shop' })
  }

  // Grants / bonos / rewards por notificación
  for (const n of (notifRes.data ?? []) as any[]) {
    const match = n.title.match(/\+(\d+)/)
    if (match) {
      const label = n.type === 'CHALLENGE_REWARD' ? 'Recompensa de desafío'
        : n.title.includes('diario') || n.title.toLowerCase().includes('bonus') ? 'Bono diario'
        : 'SC otorgados por admin'
      txs.push({ date: n.created_at, label, amount: parseInt(match[1]), type: 'earn', source: n.type })
    }
  }

  txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const SOURCE_ICON: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    mission:         { icon: CheckCircle,      color: 'text-green-400',  bg: 'bg-green-400/10'  },
    shop:            { icon: ShoppingBag,      color: 'text-pink-400',   bg: 'bg-pink-400/10'   },
    CHALLENGE_REWARD:{ icon: Swords,           color: 'text-primary',    bg: 'bg-primary/10'    },
    STREAK_BONUS:    { icon: Flame,            color: 'text-orange-400', bg: 'bg-orange-400/10' },
    SYSTEM:          { icon: Zap,              color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  }

  const totalEarned = txs.filter(t => t.type === 'earn').reduce((s, t) => s + t.amount, 0)
  const totalSpent  = txs.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SalchiCoins</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tu historial de monedas</p>
      </div>

      {/* Balance + stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <CircleDollarSign className="w-6 h-6 text-yellow-400 mb-1" />
          <p className="text-2xl font-black text-foreground">{balance.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">Disponibles</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <p className="text-lg font-black text-green-400">+{totalEarned.toLocaleString('es-AR')}</p>
          <p className="text-xs text-muted-foreground">Ganados</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <p clas