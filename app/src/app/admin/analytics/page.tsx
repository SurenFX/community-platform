import type { XpEvent } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { Zap, Users, TrendingUp, Calendar } from 'lucide-react'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()

  const now     = new Date()
  const day7    = new Date(now.getTime() - 7  * 86400000).toISOString()
  const day30   = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [xpWeekRes, xpMonthRes, newUsersWeekRes, topEventsRes, dailyXpRes] = await Promise.all([
    (supabase.from('xp_events').select('xp_awarded').gte('created_at', day7)) as any as Promise<{ data: Pick<XpEvent,'xp_awarded'>[] | null }>,
    (supabase.from('xp_events').select('xp_awarded').gte('created_at', day30)) as any as Promise<{ data: Pick<XpEvent,'xp_awarded'>[] | null }>,
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', day7),
    (supabase.from('xp_events').select('event_type, xp_awarded').gte('created_at', day7)) as any as Promise<{ data: Pick<XpEvent,'event_type'|'xp_awarded'>[] | null }>,
    (supabase.from('xp_events').select('created_at, xp_awarded').gte('created_at', day7).order('created_at')) as any as Promise<{ data: Pick<XpEvent,'created_at'|'xp_awarded'>[] | null }>,
  ])

  const xpWeek  = xpWeekRes.data?.reduce((s, e) => s + e.xp_awarded, 0) ?? 0
  const xpMonth = xpMonthRes.data?.reduce((s, e) => s + e.xp_awarded, 0) ?? 0
  const newUsers = newUsersWeekRes.count ?? 0

  // Agrupar XP por tipo de evento
  const byEvent: Record<string, number> = {}
  for (const e of topEventsRes.data ?? []) {
    byEvent[e.event_type] = (byEvent[e.event_type] ?? 0) + e.xp_awarded
  }
  const topEvents = Object.entries(byEvent).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // XP por día (últimos 7 días)
  const byDay: Record<string, number> = {}
  for (const e of dailyXpRes.data ?? []) {
    const day = e.created_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + e.xp_awarded
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    return { day: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }), xp: byDay[key] ?? 0 }
  })
  const maxXp = Math.max(...days.map(d => d.xp), 1)

  const EVENT_LABELS: Record<string, string> = {
    DISCORD_MESSAGE: 'Mensaje Discord', TWITCH_CHAT_MESSAGE: 'Chat Twitch',
    TWITCH_WATCH_TIME: 'Watch time', YOUTUBE_COMMENT: 'Comentario YT',
    DISCORD_HELPED_USER: 'Ayuda Discord', MISSION_COMPLETED: 'Misión',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">Métricas de la comunidad</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'XP otorgado (7d)',  value: xpWeek.toLocaleString(),  icon: Zap,        color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: 'XP otorgado (30d)', value: xpMonth.toLocaleString(), icon: TrendingUp,  color: 'text-green-400',  bg: 'bg-green-400/10'  },
          { label: 'Nuevos usuarios (7d)',value: newUsers.toString(),     icon: Users,       color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
          { label: 'Eventos hoy',       value: (xpWeekRes.data?.length ?? 0).toString(), icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}><Icon className={`w-5 h-5 ${color}`} /></div>
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
              <div className="w-full rounded-t-md xp-bar transition-all" style={{ height: `${(xp / maxXp) * 100}%`, minHeight: xp > 0 ? '4px' : '0' }} />
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
          {topEvents.map(([event, xp]) => (
            <div key={event} className="flex items-center justify-between px-6 py-3">
              <p className="text-sm text-foreground">{EVENT_LABELS[event] ?? event}</p>
              <span className="text-sm font-bold text-primary">{xp.toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
