'use client'

import { useState, useTransition } from 'react'
import { Gift, Zap, CircleDollarSign, Flame, Loader2, CheckCircle } from 'lucide-react'
import { claimDailyBonus } from '@/app/actions/shop'

interface Props {
  canClaim:    boolean
  streak:      number
  nextClaimMs: number   // ms until next claim (0 if claimable now)
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

export default function DailyBonusCard({ canClaim, streak, nextClaimMs }: Props) {
  const [claimed,    setClaimed]    = useState(false)
  const [reward,     setReward]     = useState<{ xp: number; sc: number } | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  const { xp: previewXp, sc: previewSc } = nextReward(streak)

  function handleClaim() {
    startTransition(async () => {
      const result = await claimDailyBonus()
      if (result.error) {
        setError(result.error)
        return
      }
      setReward({ xp: result.xp!, sc: result.sc! })
      setClaimed(true)
    })
  }

  const alreadyClaimed = !canClaim || claimed

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-500 ${
      alreadyClaimed
        ? 'border-border bg-card'
        : 'border-primary/30 bg-card'
    }`}
    style={alreadyClaimed ? undefined : { boxShadow: '0 0 30px hsl(185 100% 45% / 0.1)' }}
    >
      {/* Glow bg cuando disponible */}
      {!alreadyClaimed && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, hsl(185 100% 45% / 0.08) 0%, transparent 60%)' }} />
      )}

      <div className="relative flex items-center gap-4">
        {/* Icono */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          alreadyClaimed ? 'bg-secondary' : 'bg-primary/15'
        }`}>
          {claimed
            ? <CheckCircle className="w-6 h-6 text-green-400" />
            : <Gift className={`w-6 h-6 ${alreadyClaimed ? 'text-muted-foreground' : 'text-primary'}`} />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground">
              {claimed ? '¡Bonus reclamado!' : 'Bonus diario'}
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
            <p className="text-xs text-muted-foreground">
              Próximo en {fmtTime(nextClaimMs)}
            </p>
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

        {/* Botón */}
        {!alreadyClaimed && (
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
    </div>
  )
}
