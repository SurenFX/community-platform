'use client'

import { useState, useTransition } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { prestigeUser } from '@/app/actions/shop'
import { PRESTIGE_LEVEL } from '@/lib/constants'

interface PrestigeModalProps {
  currentPrestige: number
  onClose: () => void
  onSuccess: (newPrestige: number) => void
}

const PRESTIGE_COLORS = [
  'text-slate-400  border-slate-400/40  bg-slate-400/10',
  'text-amber-500  border-amber-500/40  bg-amber-500/10',
  'text-cyan-400   border-cyan-400/40   bg-cyan-400/10',
  'text-violet-400 border-violet-400/40 bg-violet-400/10',
  'text-rose-400   border-rose-400/40   bg-rose-400/10',
]

function prestigeColor(p: number) {
  return PRESTIGE_COLORS[Math.min(p, PRESTIGE_COLORS.length - 1)]
}

export function PrestigeBadge({ prestige }: { prestige: number }) {
  if (!prestige) return null
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black border ${prestigeColor(prestige)}`}>
      {'★'.repeat(Math.min(prestige, 5))}{prestige > 5 ? `+${prestige - 5}` : ''} P{prestige}
    </span>
  )
}

export default function PrestigeModal({ currentPrestige, onClose, onSuccess }: PrestigeModalProps) {
  const [confirmed,  setConfirmed]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  start]         = useTransition()
  const newPrestige = currentPrestige + 1
  const bonusSc     = 500 * newPrestige

  function handlePrestige() {
    setError(null)
    start(async () => {
      const r = await prestigeUser()
      if (r.error) { setError(r.error); return }
      onSuccess(r.newPrestige!)
    })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="relative bg-card border rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl scale-in overflow-hidden"
        style={{ borderColor: 'hsl(45 100% 55% / 0.4)', boxShadow: '0 0 80px hsl(45 100% 55% / 0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(45 100% 55% / 0.08) 0%, transparent 60%)' }} />

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="text-6xl mb-4" style={{ animation: 'float 2s ease-in-out infinite' }}>👑</div>

        <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2">Prestige disponible</p>
        <h2 className="text-2xl font-black text-foreground mb-1">Prestige {newPrestige}</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Tu nivel volvera a 1 y tu XP se reseteara, pero obtenes la insignia de Prestige {newPrestige} y <span className="font-bold text-yellow-400">{bonusSc} SC</span> de bonus.
        </p>

        {/* Preview del badge */}
        <div className="flex items-center justify-center gap-3 mb-5 p-3 bg-secondary/50 rounded-xl">
          <span className="text-sm text-muted-foreground">Tu nuevo badge:</span>
          <PrestigeBadge prestige={newPrestige} />
        </div>

        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {!confirmed ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Esta accion es irreversible. Tu XP y nivel se resetean permanentemente.</span>
            </div>
            <button onClick={() => setConfirmed(true)}
              className="w-full py-3 rounded-xl font-bold text-sm border border-yellow-400/40 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-all">
              Entiendo, quiero hacer Prestige
            </button>
          </div>
        ) : (
          <button onClick={handlePrestige} disabled={isPending}
            className="w-full py-3 rounded-xl font-bold text-sm bg-yellow-400 text-black hover:bg-yellow-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '👑'}
            {isPending ? 'Procesando...' : `Confirmar Prestige ${newPrestige}`}
          </button>
        )}
      </div>
    </div>
  )
}
