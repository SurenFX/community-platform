'use client'

import { useState, useTransition } from 'react'
import { Zap, CircleDollarSign, Ban, RotateCcw, Check, Loader2, Shield, ShieldOff } from 'lucide-react'
import { grantXp, grantSc, resetUserProgress } from '@/app/actions/admin'
import { setUserAdmin, setUserBanned } from '@/app/actions/social'
import { useRouter } from 'next/navigation'

interface Props {
  userId:   string
  username: string
  isAdmin:  boolean
  isBanned: boolean
}

export default function AdminUserActions({ userId, username, isAdmin, isBanned }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [xpAmount,  setXpAmount]  = useState(100)
  const [scAmount,  setScAmount]  = useState(50)
  const [reason,    setReason]    = useState('')
  const [feedback,  setFeedback]  = useState<{ msg: string; ok: boolean } | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [adminState, setAdminState] = useState(isAdmin)
  const [bannedState, setBannedState] = useState(isBanned)

  const inputClass = "bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full"

  function fb(msg: string, ok: boolean) {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 3000)
  }

  function handleGrantXp() {
    start(async () => {
      const r = await grantXp(userId, xpAmount, reason || undefined)
      fb(r.error ?? `+${xpAmount} XP otorgados a @${username}`, !r.error)
      if (!r.error) router.refresh()
    })
  }

  function handleGrantSc() {
    start(async () => {
      const r = await grantSc(userId, scAmount, reason || undefined)
      fb(r.error ?? `+${scAmount} SC otorgados a @${username}`, !r.error)
      if (!r.error) router.refresh()
    })
  }

  function handleToggleAdmin() {
    start(async () => {
      const r = await setUserAdmin(userId, !adminState)
      if (!r.error) { setAdminState(v => !v); fb(`Admin ${!adminState ? 'activado' : 'desactivado'}`, true) }
      else fb(r.error, false)
    })
  }

  function handleToggleBan() {
    start(async () => {
      const r = await setUserBanned(userId, !bannedState)
      if (!r.error) { setBannedState(v => !v); fb(`Usuario ${!bannedState ? 'baneado' : 'desbaneado'}`, true) }
      else fb(r.error, false)
    })
  }

  function handleReset() {
    start(async () => {
      await resetUserProgress(userId)
      fb('Progreso reseteado', true)
      setResetConfirm(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <h2 className="text-sm font-bold text-foreground">Acciones admin</h2>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl ${feedback.ok ? 'bg-green-400/10 text-green-400' : 'bg-destructive/10 text-destructive'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Razón (compartida) */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Razón (opcional, aplica a grants)</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ej: Ayudó en el stream" className={inputClass} maxLength={100} />
      </div>

      {/* Grants */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground block">XP a otorgar</label>
          <input type="number" min={1} max={10000} value={xpAmount}
            onChange={e => setXpAmount(parseInt(e.target.value) || 0)} className={inputClass} />
          <div className="flex gap-1.5">
            {[50, 100, 250, 500].map(v => (
              <button key={v} onClick={() => setXpAmount(v)}
                className={`flex-1 text-xs py-1 rounded-lg border transition-all ${xpAmount === v ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-400' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={handleGrantXp} disabled={isPending || xpAmount <= 0}
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold py-2 rounded-xl text-sm transition-all">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            +{xpAmount} XP
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground block">SC a otorgar</label>
          <input type="number" min={1} max={100000} value={scAmount}
            onChange={e => setScAmount(parseInt(e.target.value) || 0)} className={inputClass} />
          <div className="flex gap-1.5">
            {[10, 50, 100, 500].map(v => (
              <button key={v} onClick={() => setScAmount(v)}
                className={`flex-1 text-xs py-1 rounded-lg border transition-all ${scAmount === v ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={handleGrantSc} disabled={isPending || scAmount <= 0}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2 rounded-xl text-sm transition-all">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleDollarSign className="w-4 h-4" />}
            +{scAmount} SC
          </button>
        </div>
      </div>

      {/* Estado */}
      <div className="flex gap-3 pt-2 border-t border-border">
        <button onClick={handleToggleAdmin} disabled={isPending}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${
            adminState ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          }`}>
          {adminState ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          {adminState ? 'Quitar admin' : 'Hacer admin'}
        </button>

        <button onClick={handleToggleBan} disabled={isPending}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${
            bannedState ? 'bg-green-400/15 border-green-400/30 text-green-400 hover:bg-green-400/25' : 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20'
          }`}>
          <Ban className="w-4 h-4" />
          {bannedState ? 'Desbanear' : 'Banear'}
        </button>

        {!resetConfirm ? (
          <button onClick={() => setResetConfirm(true)} disabled={isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-secondary text-muted-foreground hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all disabled:opacity-50">
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        ) : (
          <button onClick={handleReset} disabled={isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-destructive hover:bg-destructive/90 text-white transition-all disabled:opacity-50">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Confirmar
          </button>
        )}
      </div>
    </div>
  )
}
