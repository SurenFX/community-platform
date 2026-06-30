'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'

interface DayBucket { label: string; xp: number }

interface XpChartProps {
  weekly:  DayBucket[]
  monthly: DayBucket[]
}

export default function XpChart({ weekly, monthly }: XpChartProps) {
  const [mode, setMode] = useState<'weekly' | 'monthly'>('weekly')
  const data   = mode === 'weekly' ? weekly : monthly
  const maxXp  = Math.max(...data.map(d => d.xp), 1)
  const totalXp = data.reduce((s, d) => s + d.xp, 0)

  return (
    <div className="fade-in-up bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">XP ganada</h2>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
          <button
            onClick={() => setMode('weekly')}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all ${
              mode === 'weekly'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            7 días
          </button>
          <button
            onClick={() => setMode('monthly')}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all ${
              mode === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            30 días
          </button>
        </div>
      </div>

      {totalXp === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Sin actividad en este período</p>
      ) : (
        <>
          {/* Bars */}
          <div className="flex items-end gap-1 h-24">
            {data.map((d, i) => {
              const pct = maxXp > 0 ? (d.xp / maxXp) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  {d.xp > 0 && (
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      <div className="bg-card border border-border rounded-md px-2 py-1 text-[10px] font-medium text-foreground whitespace-nowrap shadow-lg">
                        {d.xp.toLocaleString('es-AR')} XP
                      </div>
                    </div>
                  )}
                  <div className="w-full relative flex items-end" style={{ height: '88px' }}>
                    <div
                      className="w-full rounded-t xp-bar transition-all duration-500"
                      style={{
                        height: pct > 0 ? `${Math.max(pct, 4)}%` : '2px',
                        opacity: pct > 0 ? 1 : 0.15,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* X-axis labels — show fewer when monthly */}
          <div className="flex gap-1 mt-1">
            {data.map((d, i) => {
              const show = mode === 'weekly' || i % 5 === 0 || i === data.length - 1
              return (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[9px] text-muted-foreground/60">{show ? d.label : ''}</span>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <p className="text-[11px] text-muted-foreground mt-2 text-right">
            Total: <span className="text-primary font-semibold">{totalXp.toLocaleString('es-AR')} XP</span>
          </p>
        </>
      )}
    </div>
  )
}
