'use client'

import { useState, useTransition } from 'react'
import { Trophy, Plus, Users, Ticket, Play, X, Check, Loader2, Crown, XCircle, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'
import { createRaffle, drawRaffle, cancelRaffle, deleteRaffle } from '@/app/actions/admin'

interface Raffle {
  id:           string
  title:        string
  description:  string
  prize:        string
  status:       string
  use_weighted: boolean
  min_level:    number | null
  min_xp:       number | null
  ends_at:      string
  winner_id:    string | null
  drawn_at:     string | null
}

interface PoolStats { entries: number; totalTickets: number }

interface AdminRafflesClientProps {
  raffles: Raffle[]
  poolMap: Record<string, PoolStats>
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-400/15 text-green-400',
  DRAWN:     'bg-blue-400/15 text-blue-400',
  PENDING:   'bg-yellow-400/15 text-yellow-400',
  CANCELLED: 'bg-destructive/15 text-destructive',
}

const EMPTY_FORM = {
  title: '', description: '', prize: '',
  use_weighted: false, min_level: '', min_xp: '',
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at:   new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
}

export default function AdminRafflesClient({ raffles: initial, poolMap }: AdminRafflesClientProps) {
  const [raffles,    setRaffles]    = useState(initial)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [winner,     setWinner]     = useState<Record<string, string>>({})
  const [drawingId,   setDrawingId]   = useState<string | null>(null)
  const [cancelingId,  setCancelingId]  = useState<string | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createRaffle({
        title:        form.title,
        description:  form.description,
        prize:        form.prize,
        use_weighted: form.use_weighted,
        min_level:    form.min_level ? parseInt(form.min_level) : null,
        min_xp:       form.min_xp    ? parseInt(form.min_xp)    : null,
        starts_at:    new Date(form.starts_at).toISOString(),
        ends_at:      new Date(form.ends_at).toISOString(),
      })
      if (result.error) {
        setError(result.error)
      } else {
        setShowForm(false)
        setForm(EMPTY_FORM)
        window.location.reload()
      }
    })
  }

  function handleDraw(raffleId: string) {
    setDrawingId(raffleId)
    setError(null)
    startTransition(async () => {
      const result = await drawRaffle(raffleId)
      if (result.error) {
        setError(result.error)
      } else if (result.winner) {
        setWinner(w => ({ ...w, [raffleId]: result.winner! }))
        setRaffles(prev => prev.map(r =>
          r.id === raffleId ? { ...r, status: 'DRAWN' } : r
        ))
      }
      setDrawingId(null)
    })
  }

  function handleCancel(raffleId: string) {
    setCancelingId(raffleId)
    setError(null)
    startTransition(async () => {
      const result = await cancelRaffle(raffleId)
      if (result.error) {
        setError(result.error)
      } else {
        setRaffles(prev => prev.map(r =>
          r.id === raffleId ? { ...r, status: 'CANCELLED' } : r
        ))
      }
      setCancelingId(null)
    })
  }

  function handleDelete(raffleId: string) {
    if (!confirm('¿Seguro que querés borrar este sorteo?')) return
    setDeletingId(raffleId)
    setError(null)
    startTransition(async () => {
      const result = await deleteRaffle(raffleId)
      if (result.error) {
        setError(result.error)
      } else {
        setRaffles(prev => prev.filter(r => r.id !== raffleId))
      }
      setDeletingId(null)
    })
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(true)}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
        <Plus className="w-4 h-4" /> Nuevo sorteo
      </button>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Modal crear sorteo */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Nuevo sorteo</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Sorteo de la semana" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="Participá con tus tickets acumulados" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Premio</label>
                <input value={form.prize} onChange={e => setForm(f => ({ ...f, prize: e.target.value }))} className={inputClass} placeholder="Suscripción de 3 meses" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nivel mínimo</label>
                <input type="number" min={0} value={form.min_level} onChange={e => setForm(f => ({ ...f, min_level: e.target.value }))} className={inputClass} placeholder="0 = sin requisito" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">XP mínimo</label>
                <input type="number" min={0} value={form.min_xp} onChange={e => setForm(f => ({ ...f, min_xp: e.target.value }))} className={inputClass} placeholder="0 = sin requisito" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Inicio</label>
                <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fin</label>
                <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className={inputClass} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input type="checkbox" id="weighted" checked={form.use_weighted}
                  onChange={e => setForm(f => ({ ...f, use_weighted: e.target.checked }))}
                  className="w-4 h-4 accent-primary" />
                <label htmlFor="weighted" className="text-sm text-foreground cursor-pointer">
                  Sorteo ponderado (más tickets = más chances)
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-all">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={isPending || !form.title || !form.prize}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Crear sorteo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de sorteos */}
      <div className="space-y-3">
        {raffles.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No hay sorteos todavía</p>
          </div>
        )}
        {raffles.map(raffle => {
          const stats     = poolMap[raffle.id]
          const isDrawing    = drawingId   === raffle.id && isPending
          const raffleWinner = winner[raffle.id]

          return (
            <div key={raffle.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[raffle.status] ?? ''}`}>
                      {raffle.status}
                    </span>
                    {raffle.use_weighted && (
                      <span className="text-[10px] bg-purple-400/15 text-purple-400 px-2 py-0.5 rounded font-medium">Ponderado</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{raffle.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">🎁 {raffle.prize}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(raffle.ends_at) < new Date()
                      ? <span className="text-destructive">Venció el {new Date(raffle.ends_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      : <>Cierra el {new Date(raffle.ends_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                    }
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {stats && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" /> {stats.entries} participantes
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Ticket className="w-3 h-3" /> {stats.totalTickets} tickets
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/raffles/${raffle.id}/participants`}
                      title="Ver participantes"
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {raffle.status === 'ACTIVE' && (
                      <>
                        <button onClick={() => handleDraw(raffle.id)} disabled={isDrawing}
                          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-semibold px-3 py-2 rounded-lg text-sm transition-all">
                          {isDrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Sortear
                        </button>
                        <button onClick={() => handleCancel(raffle.id)} disabled={cancelingId === raffle.id && isPending}
                          title="Cancelar sorteo"
                          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                          {cancelingId === raffle.id && isPending
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <XCircle className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(raffle.id)} disabled={deletingId === raffle.id && isPending}
                      title="Borrar sorteo"
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                      {deletingId === raffle.id && isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {(raffleWinner || raffle.status === 'DRAWN') && (
                <div className="mt-3 flex items-center