'use client'

import { Flame } from 'lucide-react'

interface StreakCalendarProps {
  streak: number
  lastClaimedAt: string | null
}

function getDayColor(daysAgo: number, streak: number, isToday: boolean): string {
  if (daysAgo >= streak) return 'bg-secondary border-border'
  if (isToday)           return 'bg-orange-500 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.6)]'
  if (daysAgo < 7)       return 'bg-orange-400/80 border-orange-400/60'
  if (daysAgo < 14)      return 'bg-amber-500/70 border-amber-500/50'
  if (daysAgo < 21)      return 'bg-amber-600/60 border-amber-600/40'
  return                        'bg-amber-700/50 border-amber-700/30'
}

export default function StreakCalendar({ streak, lastClaimedAt }: StreakCalendarProps) {
  const DAYS = 30

  // Determine if today is already claimed
  const claimedToday = lastClaimedAt
    ? new Date(lastClaimedAt).toDateString() === new Date().toDateString()
    : false

  // Build day cells — index 0 = today, index 29 = 29 days ago
  const cells = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayLabel = date.toLocaleDateString('es-AR', { weekday: 'short' }).slice(0, 2).toUpperCase()
    const dayNum   = date.getDate()
    const isToday  = i === 0

    // Active if within streak range (if not claimed today, shift by 1)
    const effectiveStreak = claimedToday ? streak : streak
    const daysAgo = claimedToday ? i : i + 1
    const active = daysAgo < effectiveStreak || (isToday && claimedToday)

    return { dayLabel, dayNum, isToday, active, daysAgo: claimedToday ? i : i + 1 }
  }).reverse() // oldest first

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          RACHA DE LOGIN
        </span>
        <span className="text-xs font-bold text-orange-400">
          {streak} {streak === 1 ? 'dia' : 'dias'} seguidos
        </span>
      </div>

      <div className="grid grid-cols-10 gap-1">
        {cells.map((cell, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div
              className={`w-full aspect-square rounded-md border transition-all ${getDayColor(cell.daysAgo, streak, cell.isToday && !!claimedToday)}`}
              title={`${cell.dayNum}`}
            />
            {cell.isToday && (
              <span className="text-[8px] text-orange-400 font-bold leading-none">hoy</span>
            )}
          </div>
        ))}
      </div>

      {!claimedToday && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Reclama el bono diario para mantener tu racha
        </p>
      )}
    </div>
  )
}
