'use client'

import { useState, useEffect } from 'react'
import { Zap, X, Clock } from 'lucide-react'

interface Props {
  event: {
    id:          string
    title:       string
    description: string | null
    multiplier:  number
    ends_at:     string
  } | null
}

function formatTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'terminando...'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0)   return `${h}h ${m}m`
  return `${m}m`
}

export default function GlobalXpEventBanner({ event }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [timeLeft,  setTimeLeft]  = useState('')

  useEffect(() => {
    if (!event) return
    const update = () => setTimeLeft(formatTimeLeft(event.ends_at))
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [event])

  if (!event || dismissed) return null
  if (new Date(event.ends_at) <= new Date()) return null

  const isTriple = event.multiplier >= 3
  const color    = isTriple
    ? 'from-purple-500/20 to-pink-500/20 border-purple-500/40'
    : 'from-yellow-500/20 to-orange-500/20 border-yellow-500/40'
  const textCol  = isTriple ? 'text-purple-300' : 'text-yellow-300'
  const badgeBg  = isTriple ? 'bg-purple-500/30 border-purple-400/50 text-purple-300' : 'bg-yellow-500/30 border-yellow-400/50 text-yellow-300'

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r ${color} px-5 py-4`}
      style={{ boxShadow: isTriple ? '0 0 24px hsl(270 80% 60% / 0.2)' : '0 0 24px hsl(45 100% 55% / 0.2)' }}>
      {/* Shimmer sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      </div>

      <div className="relative flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${badgeBg} animate-pulse`}>
          <Zap className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-black ${textCol}`}>{event.title}</span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${badgeBg}`}>
              x{event.multiplier} XP
            </span>
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${textCol}`}>
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}
          </span>
          <button onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
