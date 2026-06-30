'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap } from 'lucide-react'

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE: 'Mensaje Discord', DISCORD_REACTION_RECEIVED: 'Reaccion recibida',
  DISCORD_REACTION_GIVEN: 'Reaccion dada', DISCORD_VOICE_TIME: 'Voz Discord',
  DISCORD_JOIN: 'Se unio Discord', TWITCH_WATCH_TIME: 'Watch time',
  TWITCH_CHAT_MESSAGE: 'Chat Twitch', TWITCH_FOLLOW: 'Follow Twitch',
  TWITCH_SUBSCRIBE: 'Sub Twitch', TWITCH_GIFT_SUB: 'Gift sub',
  KICK_CHAT_MESSAGE: 'Chat Kick', KICK_FOLLOW: 'Follow Kick', KICK_SUBSCRIBE: 'Sub Kick',
  YOUTUBE_COMMENT: 'Comentario YT', YOUTUBE_SUBSCRIBE: 'Sub YouTube',
  TELEGRAM_MESSAGE: 'Mensaje Telegram', TELEGRAM_JOIN: 'Se unio Telegram',
  TELEGRAM_REACTION: 'Reaccion Telegram', MISSION_COMPLETED: 'Mision completada',
  STREAK_BONUS: 'Bonus racha', BADGE_EARNED: 'Badge ganado',
  ADMIN_MANUAL_GRANT: 'Grant manual', WHEEL_SPIN: 'Rueda',
}

const PLATFORM_COLORS: Record<string, string> = {
  DISCORD: 'text-indigo-400', TWITCH: 'text-purple-400', KICK: 'text-[#53FC18]',
  YOUTUBE: 'text-red-400', TELEGRAM: 'text-sky-400', SYSTEM: 'text-primary',
}

interface XpEvent {
  id:         string
  user_id:    string
  event_type: string
  xp_awarded: number
  platform:   string | null
  created_at: string
  username?:  string
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export default function XpLogClient({ initialEvents }: { initialEvents: XpEvent[] }) {
  const [events, setEvents] = useState<XpEvent[]>(initialEvents)
  const [pulse,  setPulse]  = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-xp-log')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'xp_events',
      }, async (payload) => {
        const row = payload.new as any
        // fetch username
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', row.user_id)
          .single()

        const newEvent: XpEvent = {
          id:         row.id,
          user_id:    row.user_id,
          event_type: row.event_type,
          xp_awarded: row.xp_awarded,
          platform:   row.platform ?? null,
          created_at: row.created_at,
          username:   (profile as any)?.username ?? '—',
        }

        setPulse(true)
        setTimeout(() => setPulse(false), 800)
        setEvents(prev => [newEvent, ...prev].slice(0, 100))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-green-400 transition-all ${pulse ? 'scale-150' : ''}`} />
          <span className="text-xs text-muted-foreground">En vivo — últimos {events.length} eventos</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Hora</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Evento</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Plataforma</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e, i) => {
                const platformColor = PLATFORM_COLORS[e.platform ?? 'SYSTEM'] ?? 'text-muted-foreground'
                const isNew = i === 0 && pulse
                return (
                  <tr key={e.id} className={`transition-colors ${isNew ? 'bg-primary/5' : 'hover:bg-secondary/30'}`}>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      <div>{timeStr(e.created_at)}</div>
                      <div className="text-[10px] opacity-60">{dateStr(e.created_at)}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{e.username ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {EVENT_LABELS[e.event_type] ?? e.event_type}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-bold ${platformColor}`}>
                        {e.platform ?? 'SYSTEM'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-yellow-400 font-black text-sm">+{e.xp_awarded}</span>
                    </td>
                  </tr>
                )
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sin eventos todavía
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
