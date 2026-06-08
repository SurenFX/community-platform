'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { getRankTier } from '@/lib/utils'
import { CheckCircle2, Lock, ChevronRight } from 'lucide-react'

interface Milestone {
  level:   number
  reward:  string
  icon:    string
  type:    'xp' | 'sc' | 'badge' | 'cosmetic' | 'title'
}

const MILESTONES: Milestone[] = [
  { level:  3, reward: '+50 SC',          icon: '', type: 'sc'       },
  { level:  5, reward: 'Titulo: Soldado', icon: '', type: 'title'    },
  { level:  8, reward: '+100 SC',         icon: '', type: 'sc'       },
  { level: 10, reward: 'Border Cyan',     icon: '', type: 'cosmetic' },
  { level: 15, reward: '+200 SC',         icon: '', type: 'sc'       },
  { level: 20, reward: 'Badge Rango',     icon: '', type: 'badge'    },
  { level: 25, reward: '+300 SC',         icon: '', type: 'sc'       },
  { level: 30, reward: 'Border Gold',     icon: '', type: 'cosmetic' },
  { level: 40, reward: 'Badge Leyenda',   icon: '', type: 'badge'    },
  { level: 50, reward: 'Prestirio +1',    icon: '', type: 'badge'    },
]

const TYPE_ICONS: Record<string, string> = {
  xp:       '',
  sc:       '',
  badge:    '',
  cosmetic: '',
  title:    '',
}

const TYPE_COLORS: Record<string, string> = {
  xp:       'text-purple-400 bg-purple-400/15 border-purple-400/30',
  sc:       'text-yellow-400 bg-yellow-400/15 border-yellow-400/30',
  badge:    'text-cyan-400   bg-cyan-400/15   border-cyan-400/30',
  cosmetic: 'text-pink-400   bg-pink-400/15   border-pink-400/30',
  title:    'text-green-400  bg-green-400/15  border-green-400/30',
}

interface Props {
  currentLevel: number
  seasonName?:  string | null
}

export default function SeasonPassTrack({ currentLevel, seasonName }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Find the index of the next unclaimed milestone to auto-scroll to
  const nextIdx = MILESTONES.findIndex(m => m.level > currentLevel)

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base"></span>
          <div>
            <p className="text-sm font-black text-foreground">
              Pase de Temporada
            </p>
            {seasonName && <p className="text-[10px] text-muted-foreground">{seasonName}</p>}
          </div>
        </div>
        <div className={cn(
          'px-2.5 py-1 rounded-lg border text-xs font-bold',
          getRankTier(currentLevel).color,
          getRankTier(currentLevel).bg,
          getRankTier(currentLevel).border,
        )}>
          Nv. {currentLevel}
        </div>
      </div>

      {/* Track — horizontal scroll */}
      <div ref={scrollRef} className="overflow-x-auto scrollbar-none px-5 py-5">
        <div className="flex items-center gap-0 min-w-max">
          {MILESTONES.map((m, i) => {
            const done    = currentLevel >= m.level
            const current = !done && (i === 0 || currentLevel >= MILESTONES[i - 1].level)
            const pct     = current
              ? Math.round(((currentLevel - (MILESTONES[i - 1]?.level ?? 0)) / (m.level - (MILESTONES[i - 1]?.level ?? 0))) * 100)
              : 0
            const tier    = getRankTier(m.level)

            return (
              <div key={m.level} className="flex items-center">
                {/* Connecting line before node */}
                {i > 0 && (
                  <div className="relative w-12 h-1.5 rounded-full bg-secondary overflow-hidden mx-1">
                    {done && <div className="absolute inset-0 xp-bar rounded-full" />}
                    {current && (
                      <div
                        className="absolute inset-y-0 left-0 xp-bar rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                )}

                {/* Milestone node */}
                <div className="flex flex-col items-center gap-1.5 group">
                  {/* Reward label (above) */}
                  <div className={cn(
                    'text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap transition-all',
                    done || current ? TYPE_COLORS[m.type] : 'text-muted-foreground/40 bg-transparent border-transparent',
                  )}>
                    {TYPE_ICONS[m.type]} {m.reward}
                  </div>

                  {/* Circle node */}
                  <div className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-300',
                    done
                      ? `${tier.bg} ${tier.border} shadow-[0_0_12px_hsl(185_100%_45%/0.3)]`
                      : current
                      ? 'border-primary/60 bg-primary/10 shadow-[0_0_8px_hsl(185_100%_45%/0.2)] scale-110'
                      : 'border-border/40 bg-secondary/30',
                  )}>
                    {done
                      ? <CheckCircle2 className={cn('w-5 h-5', tier.color)} />
                      : current
                      ? <span className={cn('text-base font-black', getRankTier(currentLevel).color)}>{currentLevel}</span>
                      : <Lock className="w-4 h-4 text-muted-foreground/30" />
                    }
                  </div>

                  {/* Level label (below) */}
                  <span className={cn(
                    'text-[10px] font-bold',
                    done    ? tier.color : current ? 'text-primary' : 'text-muted-foreground/30'
                  )}>
                    {m.level}
                  </span>
                </div>
              </div>
            )
          })}

          {/* END cap */}
          <div className="flex items-center">
            <div className="w-12 h-1.5 rounded-full bg-secondary mx-1" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="text-[9px] font-bold px-2 py-0.5 rounded-full border text-muted-foreground/30 border-transparent">
                Prestirio
              </div>
              <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-yellow-400/20 bg-yellow-400/5 flex items-center justify-center">
                <span className="text-xl"></span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/30">Max</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="px-5 pb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {MILESTONES.filter(m => currentLevel >= m.level).length}/{MILESTONES.length} hitos
        </span>
        {nextIdx >= 0 && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <ChevronRight className="w-3.5 h-3.5" />
            Prox: Nv. {MILESTONES[nextIdx].level} — {MILESTONES[nextIdx].reward}
          </span>
        )}
      </div>
    </div>
  )
}
