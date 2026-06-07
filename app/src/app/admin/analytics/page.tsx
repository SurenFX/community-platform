import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Zap, Users, TrendingUp, Calendar, ShoppingBag, Swords, Flame, CircleDollarSign } from 'lucide-react'

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const admin    = adminDb()

  const now   = new Date()
  const day7  = new Date(now.getTime() - 7  * 86400000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    xpWeekRes, xpMonthRes, newUsersRes, topEventsRes, dailyXpRes, todayCountRes,
    shopSalesRes, bonusClaimedTodayRes, activeChallengesRes, totalScRes,
  ] = await Promise.all([
    supabase.rpc('get_xp_sum_since',       { since_ts: day7  }),
    supabase.rpc('get_xp_sum_since',       { since_ts: day30 }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', day7),
    supabase.rpc('get_top_event_types',    { since_ts: day7, max_rows: 5 }),
    supabase.rpc('get_daily_xp',           { since_ts: day7  }),
    supabase.rpc('get_events_count_since', { since_ts: today }),
    // Ventas de tienda (últimos 7 días)
    admin.from('user_inventory').select('id', { count: 'exact', head: true }).gte('created_at', day7),
    // Bonos diarios reclamados hoy
    admin.from('user_reputation').select('id', { count: 'exact', head: true }).gte('last_daily_bonus_at', today),
    // Desafíos activos
    admin.from('community_challenges').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    // Total SalchiCoins en circulación
    admin.from('user_reputation').select('salchi_coins'),
  ])

  const xpWeek       = (xpWeekRes.data  as unknown as number) ?? 0
  const xpMonth      = (xpMonthRes.data as unknown as number) ?? 0
  const newUsers     = newUsersRes.count ?? 0
  const todayEvents  = (todayCountRes.data as unknown as number) ?? 0
  const shopSales    = shopSalesRes.count ?? 0
  const bonusToday   = bonusClaimedTodayRes.count ?? 0
  const activeChallenges = activeChallengesRes.count ?? 0
  const totalSc      = ((totalScRes.data ?? []) as any[]).reduce((s, u) => s + (u.salchi_coins ?? 0), 0)

  const topEvents: { event_type: string; total_xp: number }[] = (topEventsRes.data as any) ?? []

  const dailyMap: Record<string, number> = {}
  for (const row of (dailyXpRes.data as any[] ?? [])) {
    dailyMap[row.day] = Number(row.total_xp)
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(now.getTime() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    return {
      day: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
      xp:  dailyMap[key] ?? 0,
    }
  })
  const maxXp = Math.max(...days.map(d => d.xp), 1)

  const EVENT_LABELS: Record<string, string> = {
    DISCORD_MESSAGE:           'Mensaje Discord',
    DISCORD_REACTION_RECEIVED: 'Reacción Discord',
    DISCORD_HELPED_USER:       'Ayuda Discord',
    DISCORD_VOICE_TIME:        'Voz Discord',
    TWITCH_CHAT_MESSAGE:       'Chat Twitch',
    TWITCH_WATCH_TIME:         'Watch time',
    TWITCH_FOLLOW:             'Follow Twitch',
    TWITCH_SUBSCRIBE:          'Sub Twitch',
    TWITCH_RAID_PARTICIPATE:   'Raid Twitch',
    YOUTUBE_COMMENT:           'Comentario YT',
    YOUTUBE_SUBSCRIBE:         'Sub YouTube',
    TELEGRAM_MESSAGE:          'Mensaje Telegram',
    MISSION_COMPLETED:         'Quest completada',
    STREAK_BONUS:              'Bonus racha',
    BADGE_EARNED:              'Logro desbloqueado',
    ADMIN_MANUAL_GRANT:        'XP manual / bono diario',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">Métricas de la comunidad</p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'XP otorgado (7d)',    value: xpWeek.toLocaleString(),   icon: Zap,        color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: 'XP otorgado (30d)',   value: xpMonth.toLocaleString(),  icon: TrendingUp, color: 'text-green-400',  bg: 'bg-green-400/10'  },
          { label: 'Nuevos usuarios (7d)',value: newUsers.toString(),        icon: Users,      color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
          { label: 'Eventos hoy',         value: todayEvents.toLocaleString(), icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Stats de gamificación */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Compras en tienda (7d)', value: shopSales,   icon: ShoppingBag,      color: 'text-pink-400',   bg: 'bg-pink-400/10'   },
          { label: 'Bonos diarios hoy',      value: bonusToday,  icon: Flame,            color: 'text-orange-400', bg: 'bg-orange-400/10' },
          { label: 'Desafíos activos',       value: activeChallenges, icon: Swords,      color: 'text-primary',    bg: 'bg-primary/10'    },
          { label: 'SC en circulación',      value: totalSc.toLocaleString('es-AR'), icon: CircleDollarSign, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* XP por día */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-6">XP por día (últimos 7 días)</h2>
        <div className="flex items-end gap-3 h-32">
          {days.map(({ day, xp }) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">{xp > 0 ? xp.toLocaleString() : ''}</span>
              <div className="w-full rounded-t-md xp-bar transition-all"
                style={{ height: `${(xp / maxXp) * 100}%`, minHeight: xp > 0 ? '4px' : '0' }} />
              <span className="text-xs text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top eventos */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Top fuentes de XP (7 días)</h2>
        </div>
        <div className="divide-y divide-border">
          {topEvents.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">Sin datos suficientes.</p>
          ) : topEvents.map(({ event_type, total_xp }) => (
            <div key={event_type} className="flex items-center justify-between px-6 py-3">
              <p className="text-sm text-foreground">{EVENT_LABELS[event_type] ?? event_type}</p>
              <span className="text-sm font-bold text-primary">{Number(total_xp).toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
