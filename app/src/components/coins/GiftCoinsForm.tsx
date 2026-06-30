'use client'

import { useState, useTransition } from 'react'
import { Gift, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { giftCoins } from '@/app/actions/shop'

interface Props { balance: number }

export default function GiftCoinsForm({ balance }: Props) {
  const [open,       setOpen]       = useState(false)
  const [username,   setUsername]   = useState('')
  const [amount,     setAmount]     = useState('')
  const [message,    setMessage]    = useState('')
  const [result,     setResult]     = useState<{ ok?: boolean; error?: string } | null>(null)
  const [isPending,  startTransition] = useTransition()

  function reset() {
    setUsername('')
    setAmount('')
    setMessage('')
    setResult(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseInt(amount)
    if (!username.trim() || isNaN(amt) || amt < 1) return
    setResult(null)
    startTransition(async () => {
      const res = await giftCoins(username.trim(), amt, message.trim() || undefined)
      if (res.error) {
        setResult({ error: res.error })
      } else {
        setResult({ ok: true })
        setTimeout(() => { reset(); setOpen(false) }, 2000)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-sm font-semibold rounded-xl hover:bg-yellow-400/20 transition-all"
      >
        <Gift className="w-4 h-4" />
        Regalar SC
      </button>
    )
  }

  return (
    <div className="bg-card border border-yellow-400/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-foreground">Regalar SalchiCoins</h2>
        <button
          onClick={() => { reset(); setOpen(false) }}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      {result?.ok ? (
        <div className="flex items-center gap-2 text-green-400 text-sm font-semibold py-2">
          <CheckCircle className="w-4 h-4" />
          ¡Regalo enviado!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Usuario</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="nombre de usuario"
              required
              className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Cantidad <span className="text-muted-foreground/60">(tenés {balance.toLocaleString('es-AR')} SC)</span>
            </label>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number"
              min={1}
              max={balance}
              placeholder="ej: 100"
              required
              className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Mensaje (opcional)</label>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={100}
              placeholder="Un mensajito..."
              className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {result?.error && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {result.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !username.trim() || !amount}
            className="w-full py-2.5 rounded-xl bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><Gift className="w-4 h-4" /> Enviar regalo</>
            }
          </button>
        </form>
      )}
    </div>
  )
}
