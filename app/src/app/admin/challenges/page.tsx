import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createChallenge, updateChallengeStatus } from '@/app/actions/adminChallenges'
import { Swords, CheckCircle2, XCircle, Clock, Zap, CircleDollarSign, Plus } from 'lucide-react'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTimeLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Vencido'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

const STATUS_CONFIG = {
  ACTIVE:    { label: 'Activo',    color: 'text-green-400',  bg: 'bg-green-400/10',   icon: Clock        },
  COMPLETED: { label: '¡Logrado!', color: 'text-primary',    bg: 'bg-primary/10',      icon: CheckCircle2 },
  FAILED:    { label: 'Fallido',   color: 'text-red-400',    bg: 'bg-red-400/10',      icon: XCircle      },
}

export default async function AdminChallengesPage() {
  const admin = adminClient()

  const { data: challenges } = await admin
    .from('community_challenges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Desafíos comunitarios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Retos colectivos: si la comunidad cumple el objetivo de XP, todos los miembros ganan la recompensa.
        </p>
      </div>

      {/* Crear desafío */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Nuevo desafío
        </h2>

        <form action={createChallenge} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Título *
              </label>
              <input
                name="title"
                placeholder="Ej: ¡Semana de fuego! Alcancemos 50,000 XP"
                required
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Descripción
              </label>
              <textarea
                name="description"
                placeholder="Detalle opcional del desafío..."
                rows={2}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Meta XP *
                </label>
                <input
                  name="goal_xp"
                  type="number"
                  min="1"
                  placeholder="50000"
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Recompensa XP
                </label>
                <input
                  name="reward_xp"
                  type="number"
                  min="0"
                  placeholder="100"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Recompensa SC
                </label>
                <input
                  name="reward_sc"
                  type="number"
                  min="0"
                  placeholder="5"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Duración (días)
              </label>
              <select
                name="duration_days"
                defaultValue="7"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="1">1 día</option>
                <option value="3">3 días</option>
                <option value="7">7 días</option>
                <option value="14">14 días</option>
                <option value="30">30 días</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Crear desafío
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {(challenges ?? []).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Swords className="w-8 h-8 mx-auto mb-3 opacity-30" />
            Sin desafíos aún.
          </div>
        ) : (
          (challenges as any[]).map((ch: any) => {
            const cfg        = STATUS_CONFIG[ch.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ACTIVE
            const StatusIcon = cfg.icon
            const isActive   = ch.status === 'ACTIVE'

            return (
              <div
                key={ch.id}
                className={`bg-card border border-border rounded-2xl p-5 ${!isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground text-sm">{ch.title}</p>
                    {ch.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{ch.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        Meta: {Number(ch.goal_xp).toLocaleString('es-AR')} XP
                      </span>
                      {ch.reward_xp_per_user > 0 && (
                        <span className="flex items-center gap-1 text-xs text-purple-400">
                          <Zap className="w-3 h-3" />+{ch.reward_xp_per_user} XP/usuario
                        </span>
                      )}
                      {ch.reward_sc_per_user > 0 && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                          <CircleDollarSign className="w-3 h-3" />+{ch.reward_sc_per_user} SC/usuario
                        </span>
                      )}
                      {isActive && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {fmtTimeLeft(ch.ends_at)} restantes
                        </span>
                      )}
                      {!isActive && (
                        <span className="text-xs text-muted-foreground">
                          Cerró: {fmtDate(ch.ends_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones — solo para desafíos activos */}
                  {isActive && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <form action={async () => {
                        'use server'
                        await updateChallengeStatus(ch.id, 'COMPLETED')
                      }}>
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors w-full"
                        >
                          ✓ Completado
                        </button>
                      </form>
                      <form action={async () => {
                        'use server'
                        await updateChallengeStatus(ch.id, 'FAILED')
                      }}>
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-colors w-full"
                        >
                          ✗ Fallido
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
