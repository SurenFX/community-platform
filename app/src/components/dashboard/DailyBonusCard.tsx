'use client'
import { useState, useEffect, useTransition } from 'react'
import { Flame, Zap, CircleDollarSign, Loader2, CheckCircle } from 'lucide-react'
import { claimDailyBonus, getDailyBonusStatus } from '@/app/actions/shop'
import { useConfetti } from '@/hooks/useConfetti'

function fmtTime(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function nextReward(streak: number) {
  if (streak >= 30) return { xp: 200, sc: 10 }
  if (streak >= 7)  return { xp: 100, sc: 5 }
  if (streak >= 3)  return { xp: 50,  sc: 2 }
  return { xp: 25, sc: 1 }
}

// Mon=0 ... Sun=6
function todayFlameIndex() {
  const dow = new Date().getDay() // JS: 0=Sun
  return dow === 0 ? 6 : dow - 1
}

type Status = 'loading' | 'can_claim' | 'claimed'
type FlameState = 'lit' | 'blinking' | 'dim'

export default function DailyBonusCard() {
  const [status,    setStatus]    = useState<Status>('loading')
  const [streak,    setStreak]    = useState(0)
  const [nextMs,    setNextMs]    = useState(0)
  const [reward,    setReward]    = useState<{ xp: number; sc: number } | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { burst } = useConfetti()

  // Server action uses admin client — no RLS issues, always fresh from DB
  useEffect(() => {
    const todayUTC = new Date().toISOString().slice(0, 10)

    // Cookie fast-path: instant optimistic state while server action loads
    const cookieClaimed = document.cookie
      .split('; ')
      .find(r => r.startsWith('daily_bonus_claimed='))
      ?.split('=')[1] === todayUTC

    if (cookieClaimed) {
      const nextMidnight = new Date(todayUTC + 'T00:00:00Z').getTime() + 86_400_000
      setNextMs(Math.max(0, nextMidnight - Date.now()))
      setStatus('claimed')
    }

    getDailyBonusStatus().then(({ claimed, streak, nextMs }) => {
      setStreak(streak)
      if (claimed) {
        setNextMs(nextMs)
        setStatus('claimed')
      } else {
        setStatus('can_claim')
      }
    })
  }, [])

  function handleClaim() {
    startTransition(async () => {
      const result = await claimDailyBonus()
      if (result.error) { setError(result.error); return }
      setReward({ xp: result.xp!, sc: result.sc! })
      setStreak(s => s + 1)
      setStatus('claimed')
      const todayUTC = new Date().toISOString().slice(0, 10)
      const nextMidnight = new Date(todayUTC + 'T00:00:00Z').getTime() + 86_400_000
      setNextMs(Math.max(0, nextMidnight - Date.now()))
      burst()
    })
  }

  const todayIdx  = todayFlameIndex()
  const isClaimed = status === 'claimed'
  const { xp: previewXp, sc: previewSc } = nextReward(streak)

  // Claims this week (Mon-Sun UTC): always fills L→R, resets every Monday automatically
  // todayIdx = days elapsed this week (0=Mon...6=Sun)
  const weekClaims = status === 'loading' ? 0
    : Math.min(streak, isClaimed ? todayIdx + 1 : todayIdx)

  function getFlameState(i: number): FlameState {
    if (status === 'loading') return 'dim'
    if (i < weekClaims) return 'lit'
    if (i === weekClaims && status === 'can_claim') return 'blinking'
    return 'dim'
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-4 w-32 rounded bg-secondary animate-pulse mb-4" />
        <div className="flex gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 h-14 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
        <div className="mt-3 flex gap-3">
          <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
          <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      {/* CSS keyframes for the blinking flame */}
      <style>{`
        @keyframes flamePulse {
          0%, 100% {
            opacity: 0.2;
            transform: scale(0.75);
            filter: drop-shadow(0 0 0px rgba(251,146,60,0));
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
            filter: drop-shadow(0 0 12px rgba(251,146,60,0.95));
          }
        }
        .flame-blink { animation: flamePulse 1.4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-bold text-foreground">Bonus diario</span>
          {streak >= 2 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-400/15 text-orange-400 text-[10px] font-black">
              {streak}d
            </span>
          )}
        </div>
        {isClaimed && (
          <span className="flex items-center gap-1.5 text-xs text-green-400/80">
            <CheckCircle className="w-3 h-3" />
            Reclamado
          </span>
        )}
      </div>

      {/* 7 Flames */}
      <div className="flex gap-2">
        {[...Array(7)].map((_, i) => {
          const state = getFlameState(i)
          const isClickable = state === 'blinking' && !isPending
          return (
            <button
              key={i}
              onClick={isClickable ? handleClaim : undefined}
              disabled={!isClickable}
              className={`
                flex-1 flex items-center justify-center py-4 rounded-xl transition-all duration-300
                ${state === 'lit'
                  ? 'bg-orange-500/15'
                  : state === 'blinking'
                  ? 'bg-orange-500/10 hover:bg-orange-500/20 cursor-pointer'
                  : 'bg-secondary/40 cursor-default'}
              `}
              style={state === 'blinking'
                ? { boxShadow: '0 0 16px rgba(251,146,60,0.25)' }
                : state === 'lit'
                ? { boxShadow: '0 0 8px rgba(251,146,60,0.15)' }
                : undefined}
            >
              {state === 'lit' ? (
                <Flame
                  className="w-7 h-7 text-orange-400"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.8))' }}
                />
              ) : state === 'blinking' ? (
                isPending
                  ? <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                  : <Flame className="w-7 h-7 text-orange-400 flame-blink" />
              ) : (
                <Flame className="w-5 h-5 text-muted-foreground/20" />
              )}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="w-3 h-3 text-purple-400" />
            {isClaimed && reward ? `+${reward.xp} XP` : `+${previewXp} XP`}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CircleDollarSign className="w-3 h-3 text-yellow-400" />
            {isClaimed && reward ? `+${reward.sc} SC` : `+${previewSc} SC`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          {isClaimed
            ? <span>Diario en {fmtTime(nextMs)}</span>
            : <span>Diario: disponible</span>
          }
          <span>·</span>
          <span>Semanal en {7 - todayIdx}d</span>
        </div>
      </div>

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  )
}
