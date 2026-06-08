'use client'

import { useState, useRef, useTransition } from 'react'
import { CircleDollarSign, Loader2, RotateCcw, History } from 'lucide-react'
import { spinWheel } from '@/app/actions/shop'
import { SPIN_COST } from '@/lib/constants'

const RARITY_STYLES: Record<string, string> = {
  COMMON:    'text-slate-400 bg-slate-400/10 border-slate-400/30',
  RARE:      'text-blue-400  bg-blue-400/10  border-blue-400/30',
  EPIC:      'text-purple-400 bg-purple-400/10 border-purple-400/30',
  LEGENDARY: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/50',
}

interface Prize {
  id: string; name: string; description: string
  prize_type: string; prize_value: number
  rarity: string; weight: number; color: string; emoji: string; sort_order: number
}

interface SpinResult {
  name: string; description: string; prize_type: string
  prize_value: number; rarity: string; emoji: string; segmentIndex: number
}

interface Props {
  prizes:  Prize[]
  balance: number
  history: any[]
}

export default function SpinWheelClient({ prizes, balance: initialBalance, history: initialHistory }: Props) {
  const [balance,   setBalance]   = useState(initialBalance)
  const [spinning,  setSpinning]  = useState(false)
  const [result,    setResult]    = useState<SpinResult | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [history,   setHistory]   = useState(initialHistory)
  const [rotation,  setRotation]  = useState(0)
  const [isPending, start]        = useTransition()
  const currentRotation           = useRef(0)

  const segCount = prizes.length || 1
  const segAngle = segCount > 0 ? 360 / segCount : 45

  // Build conic-gradient from prize colors
  const gradient = prizes.map((p, i) => {
    const start = i * segAngle
    const end   = (i + 1) * segAngle
    return `${p.color} ${start}deg ${end}deg`
  }).join(', ')

  function handleSpin() {
    if (spinning || balance < SPIN_COST) return
    setError(null); setResult(null); setSpinning(true)

    start(async () => {
      const r = await spinWheel()
      if (r.error) {
        setError(r.error); setSpinning(false); return
      }
      const prize = r.prize!

      // Calculate target angle: center of winning segment, pointing up (top = 0deg)
      // Wheel spins clockwise; pointer is at top. Segment i starts at i*segAngle.
      // We want segment center at top (270deg from right = -90deg)
      const segCenter  = prize.segmentIndex * segAngle + segAngle / 2
      const targetAngle = 360 - segCenter + 270  // normalize to pointer at top
      const spins      = 5 * 360 // 5 full rotations
      const newRotation = currentRotation.current + spins + (targetAngle % 360)

      currentRotation.current = newRotation
      setRotation(newRotation)
      setBalance(b => b - SPIN_COST)

      // Show result after animation
      setTimeout(() => {
        setSpinning(false)
        setResult(prize)
        setHistory(prev => [{
          id: Date.now().toString(),
          prize_snapshot: prize,
          cost_sc: SPIN_COST,
          created_at: new Date().toISOString(),
        }, ...prev.slice(0, 9)])
      }, 4200)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rueda de la suerte</h1>
          <p className="text-muted-foreground text-sm mt-1">Gasta {SPIN_COST} SC por giro</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
          <CircleDollarSign className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-foreground">{balance.toLocaleString('es-AR')}</span>
          <span className="text-xs text-muted-foreground">SC</span>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Wheel */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 w-0 h-0"
            style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '22px solid hsl(var(--primary))' }} />

          {/* Wheel */}
          <div
            className="w-72 h-72 rounded-full relative overflow-hidden"
            style={{
              background: `conic-gradient(${gradient})`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 80px hsl(var(--primary) / 0.15)',
            }}
          >
            {/* Segment labels */}
            {prizes.map((p, i) => {
              const angle = i * segAngle + segAngle / 2
              const rad   = (angle - 90) * (Math.PI / 180)
              const r     = 95
              const x     = 144 + r * Math.cos(rad)
              const y     = 144 + r * Math.sin(rad)
              return (
                <div key={p.id}
                  className="absolute text-white text-xs font-bold pointer-events-none select-none"
                  style={{
                    left: x, top: y,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    maxWidth: 60, textAlign: 'center', fontSize: 11,
                  }}
                >
                  <div>{p.emoji}</div>
                </div>
              )
            })}

            {/* Center circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-card border-4 border-background z-10" />
            </div>
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={handleSpin}
          disabled={spinning || balance < SPIN_COST || isPending}
          className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
        >
          {spinning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {spinning ? 'Girando...' : `Girar — ${SPIN_COST} SC`}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`border rounded-2xl p-5 text-center space-y-2 ${RARITY_STYLES[result.rarity] ?? RARITY_STYLES.COMMON}`}
          style={{ animation: 'scale-in 0.4s ease' }}>
          <div className="text-5xl">{result.emoji}</div>
          <p className="text-lg font-black">{result.name}</p>
          <p className="text-sm opacity-80">{result.description}</p>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${RARITY_STYLES[result.rarity]}`}>
            {result.rarity}
          </span>
        </div>
      )}

      {/* Prizes list */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
          <span>PREMIOS POSIBLES</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {prizes.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.emoji} {p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> ULTIMOS GIROS
          </p>
          <div className="space-y-1.5">
            {history.slice(0, 5).map((h: any, i: number) => {
              const p = h.prize_snapshot
              return (
                <div key={h.id ?? i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{p?.emoji} {p?.name}</span>
                  <span className="text-muted-foreground">
                    {new Date(h.created_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
