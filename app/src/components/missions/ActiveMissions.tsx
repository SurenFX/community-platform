'use client'

import { useRef, useCallback, useEffect } from 'react'
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

const WIDGET_HEIGHT = 360
const AUTO_SCROLL_THRESHOLD = 4
const SCROLL_SPEED = 0.4 // px per frame

function MissionItem({ id, progress, missions: mission }: MissionWithData) {
  if (!mission) return null
  const pct = Math.min((progress / mission.target_count) * 100, 100)
  return (
    <div key={id} className="space-y-2 py-0.5">
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
}

export default function ActiveMissions({ missions }: ActiveMissionsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef      = useRef<number>(0)
  const isPaused     = useRef(false)
  const isDragging   = useRef(false)
  const startY       = useRef(0)
  const startScroll  = useRef(0)

  const shouldCarousel = missions.length > AUTO_SCROLL_THRESHOLD
  // Duplicamos la lista para el loop infinito
  const displayItems = shouldCarousel ? [...missions, ...missions] : missions

  // Auto-scroll
  useEffect(() => {
    if (!shouldCarousel) return
    const el = containerRef.current
    if (!el) return

    function tick() {
      if (!isPaused.current && !isDragging.current && el) {
        el.scrollTop += SCROLL_SPEED
        // Cuando llegamos a la mitad (= una copia completa), volvemos al inicio sin salto
        if (el.scrollTop >= el.scrollHeight / 2) {
          el.scrollTop = 0
        }
      }
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [shouldCarousel])

  const onMouseEnter = useCallback(() => { isPaused.current = true  }, [])
  const onMouseLeave = useCallback(() => {
    isPaused.current  = false
    isDragging.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
      containerRef.current.style.userSelect = ''
    }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current
    if (!el) return
    isDragging.current = true
    isPaused.current   = true
    startY.current     = e.clientY
    startScroll.current = el.scrollTop
    el.style.cursor    = 'grabbing'
    el.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    containerRef.current.scrollTop = startScroll.current - (e.clientY - startY.current)
  }, [])

  const onMouseUp = useCallback(() => {
    if (!containerRef.current) return
    isDragging.current  = false
    isPaused.current    = false
    containerRef.current.style.cursor = 'grab'
    containerRef.current.style.userSelect = ''
  }, [])

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col" style={{ height: `${WIDGET_HEIGHT + 64}px` }}>
      <h2 className="text-base font-semibold text-foreground mb-4">
        Misiones activas
      </h2>

      {missions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay misiones activas en este momento
        </p>
      ) : (
        <div
          ref={containerRef}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          className="overflow-hidden cursor-grab select-none flex-1"
          style={{ height: `${WIDGET_HEIGHT}px` }}
        >
          <div className="space-y-4">
            {displayItems.map((item, i) => (
              <MissionItem key={`${item.id}-${i}`} {...item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
