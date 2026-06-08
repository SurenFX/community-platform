'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Lock, Gift } from 'lucide-react'
import { claimSeasonMilestone, SEASON_MILESTONES } from '@/app/actions/seasonPass'

const TYPE_COLORS: Record<string, string> = {
  xp:       'text-purple-400 bg-purple-400/15 border-purple-400/30',
  sc:       'text-yellow-400 bg-yellow-400/15 border-yellow-400/30',
  badge:    'text-cyan-400   bg-cyan-400/15   border-cyan-400/30',
  cosmetic: 'text-pink-400   bg-pink-400/15   border-pink-400/30',
  title:    'text-green-400  bg-green-400/15  border-green-400/30',
}

const TYPE_ICONS: Record<string, string> = {
  xp: '', sc: '', badge: '', cosmetic: '', title: '',
}

interface Props {
  seasonXp:         number
  seasonId:         string | null
  seasonName?:      string | null
  claimedMilestones: number[]
}

export default function SeasonPassTrack({ seasonXp, seasonId, seasonName, claimedMilestones }: Props) {
  const [claimed, setClaimed]   = useState<number[]>(claimedMilestones)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const completedCount = SEASON_MILESTONES.filter(m => seasonXp >= m.xp).length
  const totalCount     = SEASON_MILESTONES.length

  function handleClaim(milestoneXp: number) {
    if (!seasonId) return
    startTransition(async () => {
      const res = await claimSeasonMilestone(seasonId, milestoneXp)
      if (res.ok) {
        setClaimed(prev => [...prev, milestoneXp])
        setFeedback(res.reward ?? 'Reclamado!')
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setFeedback(res.error ?? 'Error')
        setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base"></span>
          <div>
            <p className="text-sm font-black text-foreground">Pase de Temporada</p>
            {seasonName && <p className="text-[10px] text-muted-foreground">{seasonName}</p>}
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-semibold">
          {completedCount}/{totalCount} hitos
        </span>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-semibold text-center">
          {feedback}
        </div>
      )}

      {/* Track */}
      <div className="overflow-x-auto scrollbar-none px-5 py-5">
        <div className="flex items-center gap-0 min-w-max">
          {SEASON_MILESTONES.map((m, i) => {
            const reached  = seasonXp >= m.xp
            const isClaimed = claimed.includes(m.xp)
            const canClaim  = reached && !isClaimed
            const prev      = SEASON_MILESTONES[i - 1]
            const segmentPct = !reached && prev
              ? Math.min(100, Math.round(((seasonXp - prev.xp) / (m.xp - prev.xp)) * 100))
              : reached ? 100 : (i === 0 ? Math.min(100, Math.round((seasonXp / m.xp) * 100)) : 0)

            return (
              <div key={m.xp} className="flex items-center">
                {/* Connecting line */}
                {i > 0 && (
                  <div className="relative w-12 h-1.5 rounded-full bg-secondary overflow-hidden mx-1">
                    <div
                      className="absolute inset-y-0 left-0 xp-bar rounded-full transition-all duration-700"
                      style={{ width: `${segmentPct}%` }}
                    />
                  </div>
                )}

                {/* Node */}
                <div className="flex flex-col items-center gap-1.5">
                  {/* Reward label */}
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap transition-all ${
                    reached || canClaim ? TYPE_COLORS[m.type] : 'text-muted-foreground/30 border-transparent'
                  }`}>
                    {TYPE_ICONS[m.type]} {m.reward}
                  </div>

                  {/* Circle */}
                  {canClaim ? (
                    <button
                      onClick={() => handleClaim(m.xp)}
                      disabled={pending}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-yellow-400/60 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.3)] hover:bg-yellow-400/20 transition-all scale-110 animate-pulse disabled:opacity-60"
                    >
                      <Gift className="w-5 h-5 text-yellow-400" />
                    </button>
                  ) : (
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
                      isClaimed
                        ? 'bg-primary/10 border-primary/40 shadow-[0_0_8px_hsl(185_100%_45%/0.25)]'
                        : 'border-border/40 bg-secondary/30'
                    }`}>
                      {isClaimed
                        ? <CheckCircle2 className="w-5 h-5 text-primary" />
                        : <Lock className="w-4 h-4 text-muted-foreground/30" />
                      }
                    </div>
                  )}

                  {/* XP label */}
                  <span className={`text-[10px] font-bold ${
                    reached ? 'text-primary' : 'text-muted-foreground/30'
                  }`}>
                    {m.xp >= 1000 ? `${m.xp / 1000}k` : m.xp}
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
                Final
              </div>
              <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-yellow-400/20 bg-yellow-400/5 flex items-center justify-center">
                <span className="text-xl"></span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/30">60k</span>
            </div>
          </div>
        </div>
      </div>

      {/* XP progress */}
      <div className="px-5 pb-4 text-xs text-muted-foreground">
        <div className="flex justify-between mb-1">
          <span>XP de temporada</span>
          <span className="text-foreground font-semibold">{seasonXp.toLocaleString('es-AR')} XP</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full xp-bar rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, Math.round((seasonXp / 60_000) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  )
}
