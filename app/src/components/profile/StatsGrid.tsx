'use client'

import { useEffect, useRef, useState } from 'react'
import { Zap, Flame, Ticket, TrendingUp, CircleDollarSign } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { UserReputation } from '@/types/database'

interface StatsGridProps {
  reputation: UserReputation | null | undefined
}

// Hook para animar números cuando cambian
function useAnimatedNumber(value: number) {
  const [display, setDisplay]   = useState(value)
  const [flashing, setFlashing] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlashing(true)
      const start     = prevRef.current
      const end       = value
      const duration  = 600
      const startTime = performance.now()

      const animate = (now: number) => {
        const elapsed  = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased    = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setDisplay(Math.round(start + (end - start) * eased))
        if (progress < 1) requestAnimationFrame(animate)
        else {
          setDisplay(end)
          prevRef.current = end
          setTimeout(() => setFlashing(false), 300)
        }
      }
      requestAnimationFrame(animate)
    }
  }, [value])

  return { display, flashing }
}

function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string
  value: number
  sub:   string
  icon:  React.ElementType
  color: string
  bg:    string
}) {
  const { display, flashing } = useAnimatedNumber(value)

  return (
    <div className={`
      bg-card border rounded-xl p-5 card-hover transition-all duration-300 fade-in-up
      ${flashing ? 'border-primary/50' : 'border-border'}
    `}
    style={{ boxShadow: flashing ? '0 0 20px hsl(185 100% 45% / 0.15)' : undefined }}
    >
      <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3 transition-transform duration-200 group-hover:scale-110`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className={`text-2xl font-bold transition-all duration-300 ${flashing ? 'text-primary scale-110' : 'text-foreground'}`}>
        {formatNumber(display)}
      </p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>
    </div>
  )
}

export default function StatsGrid({ reputation }: StatsGridProps) {
  const stats = [
    {
      label: 'XP Total',
      value: reputation?.total_xp ?? 0,
      sub:   `${formatNumber(reputation?.weekly_xp ?? 0)} esta semana`,
      icon:  Zap,
      color: 'text-purple-400',
      bg:    'bg-purple-400/10',
    },
    {
      label: 'Racha actual',
      value: reputation?.current_streak ?? 0,
      sub:   `Récord: ${reputation?.longest_streak ?? 0} días`,
      icon:  Flame,
      color: 'text-orange-400',
      bg:    'bg-orange-400/10',
    },
    {
      label: 'SalchiCoins',
      value: reputation?.salchi_coins ?? 0,
      sub:   'SC disponibles',
      icon:  CircleDollarSign,
      color: 'text-yellow-400',
      bg:    'bg-yellow-400/10',
    },
    {
      label: 'XP del mes',
      value: reputation?.monthly_xp ?? 0,
      sub:   'Este mes',
      icon:  TrendingUp,
      color: 'text-blue-400',
      bg:    'bg-blue-400/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => <StatCard key={s.label} {...s} />)}
    </div>
  )
}
