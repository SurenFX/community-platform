import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Target } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DAILY:   { label: 'Diaria', color: 'bg-blue-400/15 text-blue-400' },
  WEEKLY:  { label: 'Semanal', color: 'bg-purple-400/15 text-purple-400' },
  SPECIAL: { label: 'Especial', color: 'bg-amber-400/15 text-amber-400' },
  EVENT:   { label: 'Evento', color: 'bg-pink-400/15 text-pink-400' },
}

export default async function MissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  const { data: missions } = await supabase
    .from('missions')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('type')

  const { data: userMissions } = await supabase
    .from('user_missions')
    .select('*')
    .eq('user_id', user.id)

  const progressMap = new Map(userMissions?.map((um) => [um.mission_id, um]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Misiones</h1>
        <p className="text-muted-foreground mt-1">
          Completá misiones para ganar XP y tickets de sorteo
        </p>
      </div>

      {(!missions || missions.length === 0) ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No hay misiones activas en este momento</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {missions.map((mission) => {
            const userMission = progressMap.get(mission.id)
            const progress = userMission?.progress ?? 0
            const isCompleted = userMission?.is_completed ?? false
            const pct = Math.min((progress / mission.target_count) * 100, 100)
            const type = TYPE_LABELS[mission.type]
            const endsIn = Math.ceil((new Date(mission.ends_at).getTime() - Date.now()) / 86400000)

            return (
              <div
                key={mission.id}
                className={`bg-card border rounded-xl p-6 transition-all ${
                  isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-border card-hover'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${type?.color}`}>
                        {type?.label}
                      </span>
                      {isCompleted && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-500/15 text-green-400">
                          ✓ Completada
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{mission.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{mission.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-purple-400">+{mission.xp_reward}</p>
                    <p className="text-xs text-muted-foreground">XP</p>
                    {mission.ticket_reward > 0 && (
                      <p className="text-xs text-green-400 mt-0.5">+{mission.ticket_reward} 🎟️</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress} / {mission.target_count}</span>
                    <span>Vence en {endsIn} día{endsIn !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-green-400' : 'xp-bar'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
