import { timeAgo } from '@/lib/utils'
import type { XpEvent } from '@/types/database'

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  DISCORD_MESSAGE:           { label: 'Mensaje en Discord', color: 'text-indigo-400' },
  DISCORD_REACTION_RECEIVED: { label: 'Reacción recibida', color: 'text-yellow-400' },
  DISCORD_HELPED_USER:       { label: 'Ayudaste a alguien', color: 'text-green-400' },
  TWITCH_WATCH_TIME:         { label: 'Viste el stream', color: 'text-purple-400' },
  TWITCH_RAID_PARTICIPATE:   { label: 'Participaste en raid', color: 'text-pink-400' },
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

export default function RecentActivity({ events }: RecentActivityProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-foreground mb-4">
        Actividad reciente
      </h2>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Todavía no hay actividad registrada
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const meta = EVENT_LABELS[event.event_type] ?? {
              label: event.event_type,
              color: 'text-muted-foreground',
            }
            return (
              <div key={event.id} className="flex items-center justify-between">
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
