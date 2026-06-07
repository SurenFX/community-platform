export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Swords, Zap, CircleDollarSign, Clock, CheckCircle2, XCircle, User } from 'lucide-react'

function fmtTime(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Terminado'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d ${h}h restantes`
  return `${h}h restantes`
}

export default async function ChallengesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: challenges } = await admin
    .from('community_challenges')
    .select('*')
    .in('status', ['ACTIVE', 'COMPLETED', 'FAILED'])
    .order('created_at', { ascending: false })
    .limit(20)

  const activeOnes = (challenges ?? []).filter((c: any) => c.status === 'ACTIVE')

  // Progreso comunitario + progreso personal para cada challenge activo
  const challengeProgress:     Record<string, number> = {}
  const challengeUserProgress: Record<string, number> = {}

  for (const ch of activeOnes as any[]) {
    const [{ data: allEvents }, { data: myEvents }] = await Promise.all([
      admin
        .from('xp_events')
        .select('xp_awarded')
        .gte('created_at', ch.starts_at)
        .lte('created_at', ch.ends_at),
      admin
        .from('xp_events')
        .select('xp_awarded')
        .eq('user_id', user.id)
        .gte('created_at', ch.starts_at)
        .lte('created_at', ch.ends_at),
    ])
    challengeProgress[ch.id]     = ((allEvents ?? []) as any[]).reduce((s, e) => s + e.xp_awarded, 0)
    challengeUserProgress[ch.id] = ((myEvents  ?? []) as any[]).reduce((s, e) => s + e.xp_awarded, 0)
  }

  const STATUS_CONFIG = {
    ACTIVE:    { label: 'Activo',     color: 'text-green-400',  bg: 'bg-green-400/10',  icon: Swords      },
    COMPLETED: { label: '¡Logrado!',  color: 'text-primary',    bg: 'bg-primary/10',    icon: CheckCircle2 },
    FAILED:    { label: 'Fallido',    color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle    },
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Desafíos comunitarios</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Objetivos colectivos — si la comunidad los cumple, todos ganan.
        </p>
      </div>

      {(challenges ?? []).length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">Sin desafíos activos</p>
          <p className="text-sm text-muted-foreground">Pronto habrá nuevos retos comunitarios.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(challenges as any[]).map((ch: any) => {
            const current     = challengeProgress[ch.id] ?? 0
            const myXp        = challengeUserProgress[ch.id] ?? 0
            const goal        = Number(ch.goal_xp)
            const pct         = ch.status === 'COMPLETED' ? 100 : Math.min(100, Math.round((current / goal) * 100))
            const myPct       = goal > 0 ? Math.min(100, Math.round((myXp / goal) * 100)) : 0
            const cfg         = STATUS_CONFIG[ch.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ACTIVE
            const StatusIcon  = cfg.icon
            const isActive    = ch.status === 'ACTIVE'
            const isCompleted = ch.status === 'COMPLETED'

            return (
              <div
                key={ch.id}
                className={`relative overflow-hidden bg-card border rounded-2xl p-5 transition-all ${
                  isCompleted ? 'border-primary/30' : isActive ? 'border-border' : 'border-border opacity-70'
                }`}
                style={isCompleted ? { boxShadow: '0 0 20px hsl(185 100% 45% / 0.1)' } : undefined}
              >
                {isCompleted && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(185 100% 45% / 0.06) 0%, transparent 60%)' }} />
                )}

                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground">{ch.title}</h3>
                    {ch.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{ch.description}</p>
                    )}
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      {fmtTime(ch.ends_at)}
                    </div>
                  )}
                </div>

                {/* Progreso comunitario */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="font-medium">Comunidad</span>
                    <span>{current.toLocaleString('es-AR')} / {goal.toLocaleString('es-AR')} XP · {pct}%</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'xp-bar' : 'bg-primary/60'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Progreso personal — solo en activos */}
                {isActive && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Tu aporte
                      </span>
                      <span className={myXp > 0 ? 'text-primary font-semibold' : ''}>
                        {myXp.toLocaleString('es-AR')} XP · {myPct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${myPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Recompensas */}
                {(ch.reward_xp_per_user > 0 || ch.reward_sc_per_user > 0) && (
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Recompensa para todos:</p>
                    {ch.reward_xp_per_user > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-purple-400">
                        <Zap className="w-3.5 h-3.5" />+{ch.reward_xp_per_user} XP
                      </span>
                    )}
                    {ch.reward_sc_per_user > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                        <CircleDollarSign className="w-3.5 h-3.5" />+{ch.reward_sc_per_user} SC
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
