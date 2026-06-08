export const revalidate = 30

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Swords, Zap, CircleDollarSign, Clock, CheckCircle2, XCircle, User, Skull, Shield, Flame } from 'lucide-react'

function fmtTime(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Terminado'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d ${h}h restantes`
  return `${h}h restantes`
}

function fmtNum(n: number) { return n.toLocaleString('es-AR') }

export default async function ChallengesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [challengesRes, bossRes] = await Promise.all([
    admin.from('community_challenges')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('boss_raids')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const challenges  = (challengesRes.data ?? []) as any[]
  const boss        = (bossRes as any).data as any | null
  const activeOnes  = challenges.filter((c: any) => c.status === 'ACTIVE')

  // Progreso community challenges
  const challengeProgress:     Record<string, number> = {}
  const challengeUserProgress: Record<string, number> = {}

  for (const ch of activeOnes) {
    const [{ data: allEvents }, { data: myEvents }] = await Promise.all([
      admin.from('xp_events').select('xp_awarded').gte('created_at', ch.starts_at).lte('created_at', ch.ends_at),
      admin.from('xp_events').select('xp_awarded').eq('user_id', user.id).gte('created_at', ch.starts_at).lte('created_at', ch.ends_at),
    ])
    challengeProgress[ch.id]     = ((allEvents ?? []) as any[]).reduce((s, e) => s + e.xp_awarded, 0)
    challengeUserProgress[ch.id] = ((myEvents  ?? []) as any[]).reduce((s, e) => s + e.xp_awarded, 0)
  }

  // Boss raid: top 5 contribuidores + mi daño
  let topHitters: any[] = []
  let myDamage = 0

  if (boss) {
    const [{ data: topData }, { data: myData }] = await Promise.all([
      admin.from('boss_raid_hits')
        .select('user_id, profiles!inner(username, avatar_url)')
        .eq('raid_id', boss.id)
        .order('damage', { ascending: false }),
      admin.from('boss_raid_hits')
        .select('damage')
        .eq('raid_id', boss.id)
        .eq('user_id', user.id),
    ])

    // Agregar daño por usuario
    const damageMap: Record<string, { username: string; avatar_url: string | null; total: number }> = {}
    for (const hit of (topData ?? []) as any[]) {
      const uid = hit.user_id
      if (!damageMap[uid]) damageMap[uid] = { username: hit.profiles?.username ?? '?', avatar_url: hit.profiles?.avatar_url, total: 0 }
      damageMap[uid].total += hit.damage ?? 0
    }
    topHitters = Object.values(damageMap).sort((a, b) => b.total - a.total).slice(0, 5)
    myDamage = ((myData ?? []) as any[]).reduce((s, h) => s + (h.damage ?? 0), 0)
  }

  const STATUS_CONFIG = {
    ACTIVE:    { label: 'Activo',    color: 'text-green-400',   bg: 'bg-green-400/10',   icon: Swords       },
    COMPLETED: { label: 'Logrado!',  color: 'text-primary',     bg: 'bg-primary/10',     icon: CheckCircle2 },
    FAILED:    { label: 'Fallido',   color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle      },
  }

  const hpPct       = boss ? Math.max(0, Math.round((boss.current_hp / boss.max_hp) * 100)) : 0
  const bossDefeated = boss?.status === 'DEFEATED'
  const hpColor     = hpPct > 50 ? 'bg-red-500' : hpPct > 25 ? 'bg-orange-500' : 'bg-yellow-500'

  const PHASE_LABELS = ['', 'Normal', 'Enfurecido', 'Desesperado']
  const PHASE_COLORS = ['', 'text-slate-400', 'text-orange-400', 'text-red-400']

  return (
    <div className="space-y-8">

      {/* ── BOSS RAID ── */}
      {boss && (
        <div className={`relative overflow-hidden bg-card border rounded-2xl transition-all ${
          bossDefeated ? 'border-primary/30 opacity-70' : 'border-red-500/30'
        }`} style={!bossDefeated ? { boxShadow: '0 0 40px rgba(239,68,68,0.12)' } : undefined}>

          {/* BG glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: bossDefeated
              ? 'radial-gradient(ellipse at 50% 0%, hsl(185 100% 45% / 0.08) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.1) 0%, transparent 60%)' }} />

          <div className="p-5 relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-5xl" style={{ animation: bossDefeated ? 'none' : 'float 3s ease-in-out infinite' }}>
                  {bossDefeated ? '💀' : (boss.emoji ?? '👹')}
                </span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Skull className="w-3 h-3" /> BOSS RAID
                    </span>
                    {!bossDefeated && boss.phase > 1 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PHASE_COLORS[boss.phase]} bg-current/10 border-current/30`}>
                        {PHASE_LABELS[boss.phase]}
                      </span>
                    )}
                    {bossDefeated && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                        DERROTADO
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-foreground">{boss.name}</h2>
                  {boss.lore && <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{boss.lore}&rdquo;</p>}
                </div>
              </div>
              {!bossDefeated && (
                <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  {fmtTime(boss.ends_at)}
                </div>
              )}
            </div>

            {/* HP Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-red-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> HP del Boss
                </span>
                <span className="text-muted-foreground font-mono">
                  {fmtNum(Math.max(0, Number(boss.current_hp)))} / {fmtNum(Number(boss.max_hp))}
                </span>
              </div>
              <div className="h-4 bg-secondary rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${bossDefeated ? 'bg-primary/50' : hpColor}`}
                  style={{ width: `${bossDefeated ? 0 : hpPct}%` }}
                />
                {!bossDefeated && hpPct > 5 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white/90">
                    {hpPct}%
                  </span>
                )}
              </div>
              {/* Phase markers */}
              <div className="relative h-1 mt-0.5">
                <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-2 bg-orange-400/60 rounded" title="Fase 2 (50%)" />
                <div className="absolute left-1/4 -translate-x-1/2 w-0.5 h-2 bg-red-400/60 rounded" title="Fase 3 (25%)" />
              </div>
            </div>

            {/* Mi daño */}
            {myDamage > 0 && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-muted-foreground">Tu daño total:</span>
                <span className="font-bold text-orange-400">{fmtNum(myDamage)} DMG</span>
              </div>
            )}

            {/* Top hitters */}
            {topHitters.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-muted-foreground mb-2">TOP GUERREROS</p>
                <div className="space-y-1.5">
                  {topHitters.map((h, i) => (
                    <div key={h.username} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-center font-black text-muted-foreground">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
                      </span>
                      {h.avatar_url
                        ? <img src={h.avatar_url} alt={h.username} className="w-5 h-5 rounded-full" />
                        : <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{h.username[0]?.toUpperCase()}</div>
                      }
                      <span className="flex-1 text-foreground font-medium">{h.username}</span>
                      <span className="font-mono text-orange-400 font-bold">{fmtNum(h.total)} DMG</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recompensas */}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Recompensa al derrotar:</p>
              {boss.reward_xp > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-purple-400">
                  <Zap className="w-3.5 h-3.5" />+{fmtNum(boss.reward_xp)} XP
                </span>
              )}
              {boss.reward_sc > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                  <CircleDollarSign className="w-3.5 h-3.5" />+{fmtNum(boss.reward_sc)} SC
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COMMUNITY CHALLENGES ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Raids comunitarios</h1>
        <p className="text-muted-foreground text-sm">Si la comunidad cumple el objetivo, todos ganan.</p>
      </div>

      {challenges.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">Sin desafios activos</p>
          <p className="text-sm text-muted-foreground">Pronto habra nuevos retos comunitarios.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map((ch: any) => {
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
              <div key={ch.id}
                className={`relative overflow-hidden bg-card border rounded-2xl p-5 transition-all ${
                  isCompleted ? 'border-primary/30' : isActive ? 'border-border' : 'border-border opacity-70'
                }`}
                style={isCompleted ? { boxShadow: '0 0 20px hsl(185 100% 45% / 0.1)' } : undefined}
              >
                {isCompleted && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(185 100% 45% / 0.06) 0%, transparent 60%)' }} />
                )}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground">{ch.title}</h3>
                    {ch.description && <p className="text-sm text-muted-foreground mt-0.5">{ch.description}</p>}
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3.5 h-3.5" />{fmtTime(ch.ends_at)}
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="font-medium">Comunidad</span>
                    <span>{fmtNum(current)} / {fmtNum(goal)} XP · {pct}%</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'xp-bar' : 'bg-primary/60'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {isActive && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> Tu aporte</span>
                      <span className={myXp > 0 ? 'text-primary font-semibold' : ''}>{fmtNum(myXp)} XP · {myPct}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${myPct}%` }} />
                    </div>
                  </div>
                )}
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
