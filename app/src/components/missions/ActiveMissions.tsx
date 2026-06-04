import type { UserMission, Mission } from '@/types/database'

interface MissionWithData extends UserMission {
  missions: Mission | null
}

interface ActiveMissionsProps {
  missions: MissionWithData[]
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DAILY:   { label: 'Diaria',   color: 'bg-blue-400/15 text-blue-400'    },
  WEEKLY:  { label: 'Semanal',  color: 'bg-purple-400/15 text-purple-400' },
  SPECIAL: { label: 'Especial', color: 'bg-amber-400/15 text-amber-400'  },
  EVENT:   { label: 'Evento',   color: 'bg-pink-400/15 text-pink-400'    },
}

export default function ActiveMissions({ missions }: ActiveMissionsProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-foreground mb-4">
        Misiones activas
      </h2>

      {missions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay misiones activas en este momento
        </p>
      ) : (
        <div className="space-y-4">
          {missions.map(({ id, progress, missions: mission }) => {
            if (!mission) return null
            const pct = Math.min((progress / mission.target_count) * 100, 100)
            return (
              <div key={id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_LABELS[mission.type]?.color ?? 'bg-secondary text-muted-foreground'}`}
                      >
                        {TYPE_LABELS[mission.type]?.label ?? mission.type}
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {mission.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {progress} / {mission.target_count}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-purple-400 shrink-0">
                    +{mission.xp_reward} XP
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full xp-bar rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
