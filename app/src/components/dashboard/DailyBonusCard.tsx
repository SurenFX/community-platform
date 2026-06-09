'use client'
import { useState, useEffect, useTransition } from 'react'
import { Flame, CheckCircle, Loader2, Zap, CircleDollarSign, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { claimDailyBonus } from '@/app/actions/shop'
import { useConfetti } from '@/hooks/useConfetti'

// Day names Mon -> Sun
const DAYS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D']

function nextReward(streak: number) {
  if (streak >= 30) return { xp: 200, sc: 10, mult: 'x8' }
  if (streak >= 7)  return { xp: 100, sc: 5,  mult: 'x4' }
  if (streak >= 3)  return { xp: 50,  sc: 2,  mult: 'x2' }
  return                   { xp: 25,  sc: 1,  mult: null  }
}

function fmtTime(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

type Status = 'loading' | 'can_claim' | 'claimed'

export default function DailyBonusCard() {
  const [status,    setStatus]    = useState<Status>('loading')
  const [streak,    setStreak]    = useState(0)
  const [nextMs,    setNextMs]    = useState(0)
  const [reward,    setReward]    = useState<{ xp: number; sc: number } | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { burst } = useConfetti()

  // Fetch bonus state — cookie fast-path first, then DB confirmation
  useEffect(() => {
    const todayUTC = new Date().toISOString().slice(0, 10)

    // Fast-path: server action sets this cookie synchronously; read it before the DB round-trip
    const cookieClaimed = document.cookie
      .split('; ')
      .find(r => r.startsWith('daily_bonus_claimed='))
      ?.split('=')[1] === todayUTC

    if (cookieClaimed) {
      const nextMidnight = new Date(todayUTC + 'T00:00:00Z').getTime() + 86_400_000
      setNextMs(Math.max(0, nextMidnight - Date.now()))
      setStatus('claimed')
      // Still fetch streak count in background (no status change)
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('user_reputation').select('current_streak').eq('user_id', user.id).single()
          .then(({ data }) => { setStreak((data as any)?.current_streak ?? 0) })
      })
      return
    }

    // No cookie — check DB for real state
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setStatus('can_claim'); return }
      supabase
        .from('user_reputation')
        .select('last_daily_bonus_at, current_streak')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) { setStatus('can_claim'); return }
          const lastDay = (data as any)?.last_daily_bonus_at?.slice(0, 10) ?? null
          const claimed = lastDay === todayUTC
          setStreak((data as any)?.current_streak ?? 0)
          if (claimed) {
            const nextMidnight = new Date(todayUTC + 'T00:00:00Z').getTime() + 86_400_000
            setNextMs(Math.max(0, nextMidnight - Date.now()))
            setStatus('claimed')
          } else {
            setStatus('can_claim')
          }
        })
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

  const { xp: previewXp, sc: previewSc, mult } = nextReward(streak)

  // ── Week calendar (Mon -> Sun fixed) ────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow      = today.getDay()
  const toMonday = dow === 0 ? -6 : 1 - dow
  const monday   = new Date(today)
  monday.setDate(today.getDate() + toMonday)
  const lastClaim = new Date(today)
  if (status === 'can_claim') lastClaim.setDate(today.getDate() - 1)
  const streakStart = new Date(lastClaim)
  if (streak > 0) streakStart.setDate(lastClaim.getDate() - (streak - 1))

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 rounded bg-secondary animate-pulse" />
            <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/50 flex gap-1.5">
          {DAYS.map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="h-2 w-4 rounded bg-secondary animate-pulse" />
              <div className="w-6 h-6 rounded-full bg-secondary animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isClaimed = status === 'claimed'

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
      isClaimed ? 'border-border bg-card' : 'border-primary/30 bg-card'
    }`} style={isClaimed ? undefined : { boxShadow: '0 0 30px hsl(185 100% 45% / 0.1)' }}>

      {!isClaimed && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, hsl(185 100% 45% / 0.08) 0%, transparent 60%)' }} />
      )}

      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          isClaimed ? 'bg-secondary' : 'bg-primary/15'
        }`}>
          {isClaimed
            ? <CheckCircle className="w-6 h-6 text-green-400" />
            : <Gift className={`w-6 h-6 text-primary`} />
          }
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-bold text-foreground">
              {isClaimed ? 'Bonus reclamado!' : 'Bonus diario'}
            </p>
            {streak >= 1 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-400/15 text-orange-400 text-[10px] font-bold">
                <Flame className="w-2.5 h-2.5" />{streak}d
              </span>
            )}
            {mult && !isClaimed && (
              <span className="px-2 py-0.5 rounded-full bg-orange-400/15 border border-orange-400/30 text-[11px] font-black text-orange-400 tracking-wide">
                {mult} XP
              </span>
            )}
          </div>

          {isClaimed && reward ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs font-semibold text-purple-400">
                <Zap className="w-3 h-3" />+{reward.xp} XP
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                <CircleDollarSign className="w-3 h-3" />+{reward.sc} SC
              </span>
            </div>
          ) : isClaimed ? (
            <p className="text-xs text-muted-foreground">Proximo en {fmtTime(nextMs)}</p>
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

        {/* Claim button */}
        {!isClaimed && (
          <button
            onClick={handleClaim}
            disabled={isPending}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold transition-all"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
            Reclamar
          </button>
        )}
      </div>

      {/* Week calendar */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
        {DAYS.map((name, i) => {
          const date    = new Date(monday)
          date.setDate(monday.getDate() + i)
          const isToday  = date.getTime() === today.getTime()
          const isFuture = date > today
          const filled   = streak > 0 && !isFuture && date >= streakStart && date <= lastClaim
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground font-medium">{name}</span>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                filled
                  ? 'bg-orange-400 text-white shadow-[0_0_6px_rgba(251,146,60,0.6)]'
                  : isToday && !isClaimed
                  ? 'bg-primary/20 border-2 border-primary/60 animate-pulse'
                  : 'bg-secondary border border-border/50'
              }`}>
                {filled
                  ? <Flame className="w-3 h-3" />
                  : isToday && !isClaimed
                  ? <Gift className="w-3 h-3 text-primary" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-border" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
