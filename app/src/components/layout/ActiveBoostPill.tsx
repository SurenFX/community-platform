'use client'

import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'

interface Boost {
  id: string
  boost_value: number
  expires_at: string
}

export default function ActiveBoostPill({ boosts }: { boosts: Boost[] }) {
  const [, tick] = useState(0)

  // Re-render cada minuto para actualizar el countdown
  useEffect(() => {
    const interval = setInterval(() => tick(n => n + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const active = boosts.filter(b => new Date(b.expires_at) > new Date())
  if (active.length === 0) return null

  const best = active.reduce((a, b) => b.boost_value > a.boost_value ? b : a)
  const mins = Math.round((new Date(best.expires_at).getTime() - Date.now()) / 60000)
  const timeLeft = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none md:left-auto md:translate-x-0 md:right-20">
      <div className="flex items-center gap-1.5 bg-yellow-500/10 backdrop-blur-sm border border-yellow-400/40 rounded-full px-3 py-1.5 shadow-[0_0_16px_rgba(234,179,8,0.25)] animate-pulse">
        <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
        <span className="text-xs font-black text-yellow-300">x{best.boost_value} XP</span>
        <span className="text-[10px] text-yellow-400/70 font-medium">{timeLeft}</span>
      </div>
    </div>
  )
}
