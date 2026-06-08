'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap } from 'lucide-react'

interface Toast {
  id:    number
  xp:    number
  label: string
  x:     number
}

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:           'Discord',
  DISCORD_REACTION_RECEIVED: 'Discord',
  DISCORD_REACTION_GIVEN:    'Discord',
  DISCORD_VOICE_TIME:        'Discord Voz',
  DISCORD_JOIN:              'Discord',
  TWITCH_CHAT_MESSAGE:       'Twitch',
  TWITCH_WATCH_TIME:         'Twitch Watch',
  TWITCH_FOLLOW:             'Twitch Follow',
  TWITCH_SUBSCRIBE:          'Twitch Sub',
  TWITCH_GIFT_SUB:           'Gift Sub',
  TWITCH_RAID_PARTICIPATE:   'Raid',
  YOUTUBE_COMMENT:           'YouTube',
  YOUTUBE_SUBSCRIBE:         'YouTube Sub',
  TELEGRAM_MESSAGE:          'Telegram',
  TELEGRAM_JOIN:             'Telegram',
  TELEGRAM_REACTION:         'Telegram',
  MISSION_COMPLETED:         'Mision',
  STREAK_BONUS:              'Racha',
  ADMIN_MANUAL_GRANT:        'Bonus',
}

export default function XpFloatingToast({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`xp-toast:${userId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'xp_events',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const ev = payload.new as any
        const xp = ev.xp_awarded ?? 0
        if (xp <= 0) return

        const id = ++counter.current
        const x  = Math.random() * 50

        setToasts(prev => [...prev, {
          id,
          xp,
          label: EVENT_LABELS[ev.event_type] ?? '',
          x,
        }])

        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2300)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 right-4 z-[9999] pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="xp-float absolute bottom-0"
          style={{ right: `${toast.x}px` }}
        >
          <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-purple-400/50 rounded-full px-3 py-1.5 shadow-[0_0_16px_rgba(167,139,250,0.5)] whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-sm font-black text-purple-300">+{toast.xp} XP</span>
            {toast.label && (
              <span className="text-[10px] text-purple-400/60 font-medium">{toast.label}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
