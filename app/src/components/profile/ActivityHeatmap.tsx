'use client'

import { useMemo } from 'react'

interface DayData {
  date:  string  // YYYY-MM-DD
  xp:    number
}

interface Props {
  events: { created_at: string; xp_awarded: number }[]
}

function toLocalDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const DAYS_SHOWN = 364  // 52 weeks * 7

const WEEK_LABELS = ['', 'L', '', 'X', '', 'V', '']
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getColor(xp: number): string {
  if (xp === 0)   return 'bg-secondary/60'
  if (xp < 50)    return 'bg-primary/20'
  if (xp < 150)   return 'bg-primary/40'
  if (xp < 400)   return 'bg-primary/70'
  return                  'bg-primary'
}

function getGlow(xp: number): string {
  if (xp >= 400)  return '0 0 6px hsl(185 100% 45% / 0.6)'
  if (xp >= 150)  return '0 0 4px hsl(185 100% 45% / 0.35)'
  return ''
}

export default function ActivityHeatmap({ events }: Props) {
  const { grid, months, maxXp, totalDaysActive } = useMemo(() => {
    // Build XP per day map
    const xpByDay: Record<string, number> = {}
    for (const e of events) {
      const day = toLocalDate(e.created_at)
      xpByDay[day] = (xpByDay[day] ?? 0) + e.xp_awarded
    }

    // Build grid: 52 columns (weeks) x 7 rows (days Sun-Sat)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    // Align to last Sunday
    const dayOfWeek = today.getUTCDay()  // 0=Sun
    const startDate = new Date(today)
    startDate.setUTCDate(today.getUTCDate() - DAYS_SHOWN - dayOfWeek)

    const cols: DayData[][] = []
    const monthLabels: { col: number; month: number }[] = []
    let prevMonth = -1

    for (let col = 0; col < 53; col++) {
      const week: DayData[] = []
      for (let row = 0; row < 7; row++) {
        const d = new Date(startDate)
        d.setUTCDate(startDate.getUTCDate() + col * 7 + row)
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        const m = d.getUTCMonth()
        if (m !== prevMonth && d <= today) {
          monthLabels.push({ col, month: m })
          prevMonth = m
        }
        week.push({ date: key, xp: d > today ? -1 : (xpByDay[key] ?? 0) })
      }
      cols.push(week)
    }

    const allXp  = Object.values(xpByDay)
    const maxXp  = allXp.length ? Math.max(...allXp) : 1
    const totalDaysActive = allXp.filter(x => x > 0).length

    return { grid: cols, months: monthLabels, maxXp, totalDaysActive }
  }, [events])

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">Actividad</span>
          <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {totalDaysActive} dias activos
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Menos</span>
          {['bg-secondary/60', 'bg-primary/20', 'bg-primary/40', 'bg-primary/70', 'bg-primary'].map(c => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span>Mas</span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="inline-block min-w-max">
          {/* Month labels */}
          <div className="flex mb-1 ml-6">
            {months.slice(-13).map(({ col, month }, i, arr) => {
              const nextCol = arr[i + 1]?.col ?? 53
              const width   = (nextCol - col) * 14
              return (
                <div key={`${month}-${col}`} style={{ width: `${width}px` }}
                  className="text-[9px] text-muted-foreground/60 font-medium shrink-0">
                  {MONTH_NAMES[month]}
                </div>
              )
            })}
          </div>

          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {WEEK_LABELS.map((label, i) => (
                <div key={i} className="w-4 h-3 text-[9px] text-muted-foreground/50 flex items-center justify-end pr-0.5">
                  {label}
                </div>
              ))}
            </div>

            {/* Grid */}
            {grid.map((week, ci) => (
              <div key={ci} className="flex flex-col gap-0.5">
                {week.map((day, ri) => {
                  if (day.xp === -1) return <div key={ri} className="w-3 h-3 rounded-sm" />
                  const color = getColor(day.xp)
                  const glow  = getGlow(day.xp)
                  return (
                    <div
                      key={ri}
                      title={day.xp > 0 ? `${day.date}: ${day.xp} XP` : day.date}
                      className={`w-3 h-3 rounded-sm transition-all duration-200 hover:scale-125 cursor-default ${color}`}
                      style={glow ? { boxShadow: glow } : undefined}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
