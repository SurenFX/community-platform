'use client'

import { useState, useTransition } from 'react'
import { X, Zap, CircleDollarSign, Loader2, Check } from 'lucide-react'
import { grantXp, grantSc } from '@/app/actions/admin'

interface GrantXpModalProps {
  userId:    string
  username:  string
  onClose:   () => void
  onGranted: (xp: number, sc: number) => void
}

type Mode = 'xp' | 'sc'

export default function GrantXpModal({ userId, username, onClose, onGranted }: GrantXpModalProps) {
  const [mode,      setMode]      = useState<Mode>('xp')
  const [amount,    setAmount]    = useState(100)
  const [reason,    setReason]    = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)
  const [isPending, startTransition] = useTransition()

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

  const presets = mode === 'xp' ? [50, 100, 250, 500] : [10, 50, 100, 500]

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = mode === 'xp'
        ? await grantXp(userId, amount, reason || undefined)
        : await grantSc(userId, amount, reason || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        onGranted(mode === 'xp' ? amount : 0, mode === 'sc' ? amount : 0)
        setTimeout(onClose, 1200)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">

        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Otorgar recursos</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Para <span className="font-semibold text-foreground">@{username}</span>
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('xp'); setAmount(100); setError(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
              mode === 'xp'
                ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            <Zap className="w-4 h-4" /> XP
          </button>
          <button
            onClick={() => { setMode('sc'); setAmount(50); setError(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
              mode === 'sc'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            <CircleDollarSign className="w-4 h-4" /> SC
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Cantidad de {mode === 'xp' ? 'XP' : 'SalchiCoins'}
            </label>
            <input
              type="number"
              min={1}
              max={mode === 'xp' ? 10000 : 100000}
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 0)}
              className={inputClass}
            />
            <div className="flex gap-2 mt-2">
              {presets.map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                    amount === v
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Razón (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: Ayudó en el stream del sábado"
              className={inputClass}
              maxLength={100}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || amount <= 0 || success}
            className={`flex-1 flex items-center justify-center gap-2 disabled:opacity-50 font-semibold py-2.5 rounded-xl text-sm transition-all ${
              mode === 'xp'
                ? 'bg-yellow-400 hover:bg-yellow-300 text-black'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {success ? (
              <><Check className="w-4 h-4" /> ¡Otorgado!</>
            ) : isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'xp' ? (
              <><Zap className="w-4 h-4" /> +{amount} XP</>
            ) : (
              <><CircleDollarSign className="w-4 h-4" /> +{amount} SC</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
