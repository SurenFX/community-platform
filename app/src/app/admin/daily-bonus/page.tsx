import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CircleDollarSign, Flame, Calendar, Zap } from 'lucide-react'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export const revalidate = 60

export default async function DailyBonusAdminPage() {
  const admin = adminClient()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  // Usuarios que reclamaron hoy
  const { data: claimedToday } = await admin
    .from('user_reputation')
    .select('user_id, current_streak, salchi_coins, last_daily_bonus_at, profiles!inner(username, avatar_url)')
    .gte('last_daily_bonus_at', todayStart.toISOString())
    .order('last_daily_bonus_at', { ascending: false })
    .limit(100)

  // Stats
  const totalToday = claimedToday?.length ?? 0
  const avgStreak  = totalToday > 0
    ? Math.round((claimedToday as any[]).reduce((s: number, u: any) => s + (u.current_streak ?? 0), 0) / totalToday)
    : 0
  const maxStreak = totalToday > 0
    ? Math.max(...(claimedToday as any[]).map((u: any) => u.current_streak ?? 0))
    : 0

  // Total usuarios con racha activa (last_daily_bonus_at de ayer o hoy)
  const yesterday = new Date(Date.now() - 86400000)
  yesterday.setUTCHours(0, 0, 0, 0)
  const { count: activeStreaks } = await admin
    .from('user_reputation')
    .select('*', { count: 'exact', head: true })
    .gte('last_daily_bonus_at', yesterday.toISOString())

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bono diario</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Usuarios que reclamaron el bono hoy y estado de rachas.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Reclamaron hoy',   value: totalToday,       icon: Calendar,        color: 'text-primary'    },
          { label: 'Rachas activas',   value: activeStreaks ?? 0, icon: Flame,          color: 'text-orange-400' },
          { label: 'Racha promedio',   value: `${avgStreak}d`,  icon: Zap,             color: 'text-purple-400' },
          { label: 'Racha más larga',  value: `${maxStreak}d`,  icon: CircleDollarSign, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="text-xl font-black text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Reclamaron hoy — {totalToday} usuarios
          </p>
        </div>

        {totalToday === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-30" />
            Nadie reclamó el bono hoy todavía.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(claimedToday as any[]).map((u: any) => {
              const streak = u.current_streak ?? 0
              const streakColor = streak >= 30 ? 'text-yellow-400' : streak >= 7 ? 'text-orange-400' : streak >= 3 ? 'text-primary' : 'text-muted-foreground'
              return (
                <div key={u.user_id} className="flex items-center gap-4 px-5 py-3">
                  {u.profiles?.avatar_url ? (
                    <img src={u.profiles.avatar_url} className="w-8 h-8 rounded-full shrink-0" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{u.profiles?.username?.[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.profiles?.username}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(u.last_daily_bonus_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-bold ${streakColor}`}>
                      <Flame className="w-3.5 h-3.5" />
                      {streak}d
                    </span>
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <CircleDollarSign className="w-3.5 h-3.5" />
                      {u.salchi_coins?.toLocaleString('es-AR')} SC
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
