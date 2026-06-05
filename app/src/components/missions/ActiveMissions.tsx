'use client'

import { useRef, useCallback } from 'react'
import type { UserMission, Mission } from '@/types/database'

const PLATFORM_FROM_OBJECTIVE: Record<string, { label: string; color: string; bg: string }> = {
  DISCORD_MESSAGE:           { label: 'Discord',  color: 'text-indigo-400',  bg: 'bg-indigo-400/15'  },
  DISCORD_REACTION_RECEIVED: { label: 'Discord',  color: 'text-indigo-400',  bg: 'bg-indigo-400/15'  },
  DISCORD_HELPED_USER:       { label: 'Discord',  color: 'text-indigo-400',  bg: 'bg-indigo-400/15'  },
  TWITCH_CHAT_MESSAGE:       { label: 'Twitch',   color: 'text-purple-400',  bg: 'bg-purple-400/15'  },
  TWITCH_WATCH_TIME:         { label: 'Twitch',   color: 'text-purple-400',  bg: 'bg-purple-400/15'  },
  TWITCH_FOLLOW:             { label: 'Twitch',   color: 'text-purple-400',  bg: 'bg-purple-400/15'  },
  TWITCH_SUBSCRIBE:          { label: 'Twitch',   color: 'text-purple-400',  bg: 'bg-purple-400/15'  },
  TWITCH_RAID_PARTICIPATE:   { label: 'Twitch',   color: 'text-purple-400',  bg: 'bg-purple-400/15'  },
  YOUTUBE_COMMENT:           { label: 'YouTube',  color: 'text-red-400',     bg: 'bg-red-400/15'     },
  YOUTUBE_SUBSCRIBE:         { label: 'YouTube',  color: 'text-red-400',     bg: 'bg-red-400/15'     },
  TELEGRAM_MESSAGE:          { label: 'Telegram', color: 'text-[#26A5E4]',  bg: 'bg-[#26A5E4]/15'  },
}

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

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startScrollTop = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    isDragging.current = true
    startY.current = e.clientY
    startScrollTop.current = el.scrollTop
    el.style.cursor = 'grabbing'
    el.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !ref.current) return
    const dy = e.clientY - startY.current
    ref.current.scrollTop = startScrollTop.current - dy
  }, [])

  const onMouseUp = useCallback(() => {
    if (!ref.current) return
    isDragging.current = false
    ref.current.style.cursor = 'grab'
    ref.current.style.userSelect = ''
  }, [])

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp }
}

export default function ActiveMissions({ missions }: ActiveMissionsProps) {
  const drag = useDragScroll()

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
      <h2 className="text-base font-semibold text-foreground mb-4">
        Misiones activas
      </h2>

      {missions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay misiones activas en este momento
        </p>
      ) : (
        <div
          ref={drag.ref}
          onMouseDown={drag.onMouseDown}
          onMouseMove={drag.onMouseMove}
          onMouseUp={drag.onMouseUp}
          onMouseLeave={drag.onMouseLeave}
          className="overflow-y-auto space-y-4 cursor-grab select-none"
          style={{ maxHeight: '280px' }}
        >
          {missions.map(({ id, progress, missions: mission }) => {
            if (!mission) return null
            const pct = Math.min((progress / mission.target_count) * 100, 100)
            return (
              <div key={id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_LABELS[mission.type]?.color ?? 'bg-secondary text-muted-foreground'}`}>
                        {TYPE_LABELS[mission.type]?.label ?? mission.type}
                      </span>
                      {PLATFORM_FROM_OBJECTIVE[mission.objective_type] && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PLATFORM_FROM_OBJECTIVE[mission.objective_type].bg} ${PLATFORM_FROM_OBJECTIVE[mission.objective_type].color}`}>
                          {PLATFORM_FROM_OBJECTIVE[mission.objective_type].label}
                        </span>
                      )}
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
        </div>
      )}
    </div>
  )
}
