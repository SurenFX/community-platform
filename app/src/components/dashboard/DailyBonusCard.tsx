'use client'

import { useState, useTransition } from 'react'
import { Sword, Zap, CircleDollarSign, Flame, Loader2, CheckCircle } from 'lucide-react'
import { claimDailyBonus } from '@/app/actions/shop'
import { useConfetti } from '@/hooks/useConfetti'

interface Props {
  canClaim:    boolean
  streak:      number
  nextClaimMs: number
}

function nextReward(streak: number) {
  if (streak >= 30) return { xp: 200, sc: 10 }
  if (streak >= 7)  return { xp: 100, sc: 5  }
  if (streak >= 3)  return { xp: 50,  sc: 2  }
  return { xp: 25, sc: 1 }
}

function fmtTime(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

function StreakCalendar({ streak, canClaim }: { streak: number; canClaim: boolean }) {
  const today = new Date()

  return (
    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
      {Array.from({ length: 7 }, (_, i) => {
        const daysAgo = 6 - i
        const date    = new Date(today)
        date.setDate(date.getDate() - daysAgo)
        const dayName = DAY_NAMES[date.getDay()]
        const isToday = daysAgo === 0

        const filled = canClaim
          ? daysAgo >= 1 && daysAgo <= streak
          : daysAgo < streak

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-muted-foreground font-medium">{dayName}</span>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                filled
                  ? 'bg-orange-400 text-white shadow-[0_0_6px_rgba(251,146,60,0.6)]'
                  : isToday && canClaim
                  ? 'bg-primary/20 border-2 border-primary/60 animate-pulse'
                  : 'bg-secondary border border-border/50'
              }`}
            >
              {filled ? (
                <Flame className="w-3 h-3" />
              ) : isToday && canClaim ? (
                <Sword className="w-3 h-3 text-primary" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-border" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function DailyBonusCard({ canClaim, streak, nextClaimMs }: Props) {
  const [claimed,   setClaimed]   = useState(false)
  const [reward,    setReward]    = useState<{ xp: number; sc: number } | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { burst } = useConfetti()

  const { xp: previewXp, sc: previewSc } = nextReward(streak)
  const alreadyClaimed = !canClaim || claimed

  function handleClaim() {
    startTransition(async () => {
      const result = await claimDailyBonus()
      if (result.error) { setError(result.error); return }
      setReward({ xp: result.xp!, sc: result.sc! })
      setClaimed(true)
      burst()
    })
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-500 ${
        alreadyClaimed ? 'border-border bg-card' : 'border-primary/30 bg-card'
      }`}
      style={alreadyClaimed ? undefined : { boxShadow: '0 0 30px hsl(185 100% 45% / 0.1)' }}
    >
      {!alreadyClaimed && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, hsl(185 100% 45% / 0.08) 0%, transparent 60%)' }} />
      )}

      <div className="relative flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          alreadyClaimed ? 'bg-secondary' : 'bg-primary/15'
        }`}>
          {claimed
            ? <CheckCircle className="w-6 h-6 text-green-400" />
            : <Sword className={`w-6 h-6 ${alreadyClaimed ? 'text-muted-foreground' : 'text-primary'}`} />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground">
              {claimed ? 'Mision completada!' : 'Mision diaria'}
            </p>
            {streak >= 3 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-400">
                <Flame className="w-3 h-3" />{streak}d
              </span>
            )}
          </div>

          {claimed && reward ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs font-semibold text-purple-400">
                <Zap className="w-3 h-3" />+{reward.xp} XP
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                <CircleDollarSign className="w-3 h-3" />+{reward.sc} SC
              </span>
            </div>
          ) : alreadyClaimed ? (
            <p className="text-xs text-muted-foreground">Proximo en {fmtTime(nextClaimMs)}</p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-purple-400" />+{previewXp} XP
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CircleDollarSign className="w-3 h-3 text-yellow-400" />+{previewSc} SC
              </span>
            </div>
          )}

          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>

        {!alreadyClaimed && (
          <button
            onClick={handleClaim}
            disabled={isPending}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold transition-all"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sword className="w-3.5 h-3.5" />}
            Reclamar
          </button>
        )}
      </div>

      <StreakCalendar streak={claimed ? streak + 1 : streak} canClaim={claimed ? false : canClaim} />
    </div>
  )
}
