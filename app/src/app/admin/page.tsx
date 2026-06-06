import { createClient } from '@/lib/supabase/server'
import { Users, Zap, Trophy, Target } from 'lucide-react'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const day7 = new Date(Date.now() - 7 * 86400000).toISOString()

  const [usersRes, weeklyXpRes, missionsRes, topUserRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.rpc('get_xp_sum_since', { since_ts: day7 }),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('user_reputation').select('user_id, total_xp, profiles!inner(username)').order('total_xp', { ascending: false }).limit(5),
  ])

  const totalUsers     = usersRes.count ?? 0
  const weeklyXp       = (weeklyXpRes.data as unknown as number) ?? 0
  const activeMissions = missionsRes.count ?? 0

  const stats = [
    { label: 'Usuarios totales',  value: totalUsers,     icon: Users,   color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
    { label: 'XP otorgado (7d)',  value: weeklyXp,       icon: Zap,     color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Misiones activas',  value: activeMissions, icon: Target,  color: 'text-green-400',  bg: 'bg-green-400/10'  },
    { label: 'Top XP total',      value: topUserRes.data?.[0] ? (topUserRes.data[0] as any).total_xp : 0, icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">Resumen general de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Top 5 usuarios</h2>
        </div>
        <div className="divide-y divide-border">
          {(topUserRes.data ?? []).map((u: any, i) => (
            <div key={u.user_id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-4">{i + 1}</span>
                <p className="text-sm font-medium text-foreground">{u.profiles?.username}</p>
              </div>
              <span className="text-sm font-bold text-primary">{u.total_xp.toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
