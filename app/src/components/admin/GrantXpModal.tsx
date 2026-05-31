'use client'

import { useState, useTransition } from 'react'
import { X, Zap, Loader2, Check } from 'lucide-react'
import { grantXp } from '@/app/actions/admin'

interface GrantXpModalProps {
  userId:   string
  username: string
  onClose:  () => void
  onGranted: (amount: number) => void
}

export default function GrantXpModal({ userId, username, onClose, onGranted }: GrantXpModalProps) {
  const [amount,    setAmount]    = useState(100)
  const [reason,    setReason]    = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)
  const [isPending, startTransition] = useTransition()

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await grantXp(userId, amount, reason || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        onGranted(amount)
        setTimeout(onClose, 1200)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-base font-bold text-foreground">Otorgar XP</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Otorgando XP a <span className="font-semibold text-foreground">@{username}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cantidad de XP</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 0)}
              className={inputClass}
            />
            <div className="flex gap-2 mt-2">
              {[50, 100, 250, 500].map(v => (
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
            className="flex-1 flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl text-sm transition-all"
          >
            {success ? (
              <><Check className="w-4 h-4" /> ¡Otorgado!</>
            ) : isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Zap className="w-4 h-4" /> +{amount} XP</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
