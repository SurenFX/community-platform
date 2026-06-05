'use client'

import { useRef, useCallback } from 'react'
import { timeAgo } from '@/lib/utils'
import type { XpEvent } from '@/types/database'

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  DISCORD_MESSAGE:           { label: 'Mensaje en Discord', color: 'text-indigo-400' },
  DISCORD_REACTION_RECEIVED: { label: 'Reacción recibida', color: 'text-yellow-400' },
  DISCORD_HELPED_USER:       { label: 'Ayudaste a alguien', color: 'text-green-400' },
  TWITCH_WATCH_TIME:         { label: 'Viste el stream',        color: 'text-purple-400' },
  TWITCH_CHAT_MESSAGE:       { label: 'Chat en el stream',      color: 'text-purple-300' },
  TWITCH_FOLLOW:             { label: 'Seguiste el canal',      color: 'text-purple-400' },
  TWITCH_SUBSCRIBE:          { label: 'Sub al canal',           color: 'text-purple-500' },
  TWITCH_GIFT_SUB:           { label: 'Gift sub',               color: 'text-pink-300' },
  TWITCH_RAID_PARTICIPATE:   { label: 'Participaste en raid',   color: 'text-pink-400' },
  TELEGRAM_MESSAGE:          { label: 'Mensaje en Telegram',    color: 'text-[#26A5E4]' },
  YOUTUBE_SUBSCRIBE:         { label: 'Sub en YouTube',         color: 'text-red-400' },
  YOUTUBE_COMMENT:           { label: 'Comentaste en YouTube', color: 'text-red-400' },
  YOUTUBE_SHARE:             { label: 'Compartiste video', color: 'text-red-300' },
  TWITTER_SHARE:             { label: 'Compartiste en Twitter', color: 'text-sky-400' },
  MISSION_COMPLETED:         { label: 'Misión completada', color: 'text-amber-400' },
  STREAK_BONUS:              { label: 'Bonus de racha', color: 'text-orange-400' },
  BADGE_EARNED:              { label: 'Badge desbloqueado', color: 'text-cyan-400' },
  ADMIN_MANUAL_GRANT:        { label: 'XP otorgado por admin', color: 'text-violet-400' },
}

interface RecentActivityProps {
  events: XpEvent[]
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

export default function RecentActivity({ events }: RecentActivityProps) {
  const drag = useDragScroll()

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
      <h2 className="text-base font-semibold text-foreground mb-4">
        Actividad reciente
      </h2>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Todavía no hay actividad registrada
        </p>
      ) : (
        <div
          ref={drag.ref}
          onMouseDown={drag.onMouseDown}
          onMouseMove={drag.onMouseMove}
          onMouseUp={drag.onMouseUp}
          onMouseLeave={drag.onMouseLeave}
          className="overflow-y-auto space-y-3 cursor-grab select-none"
          style={{ maxHeight: '230px' }}
        >
          {events.map((event) => {
            const meta = EVENT_LABELS[event.event_type] ?? {
              label: event.event_type,
              color: 'text-muted-foreground',
            }
            return (
              <div key={event.id} className="flex items-center justify-between pr-1">
                <div>
                  <p className={`text-sm font-medium ${meta.color}`}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(event.created_at)}
                  </p>
                </div>
                <span className="text-sm font-bold text-foreground">
                  +{event.xp_awarded} XP
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
