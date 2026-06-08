'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit2, Trash2, Loader2, X, Check, Dices } from 'lucide-react'
import { createWheelPrize, updateWheelPrize, deleteWheelPrize } from '@/app/actions/admin'

interface Prize {
  id:          string
  name:        string
  description: string
  prize_type:  string
  prize_value: number
  rarity:      string
  weight:      number
  color:       string
  emoji:       string
  sort_order:  number
}

const PRIZE_TYPES = ['XP', 'SC', 'ITEM', 'NOTHING']
const RARITIES    = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']

const RARITY_COLORS: Record<string, string> = {
  COMMON:    'bg-gray-500/15 text-gray-400',
  UNCOMMON:  'bg-green-500/15 text-green-400',
  RARE:      'bg-blue-500/15 text-blue-400',
  EPIC:      'bg-purple-500/15 text-purple-400',
  LEGENDARY: 'bg-yellow-400/15 text-yellow-400',
}

const EMPTY_FORM = {
  name:        '',
  description: '',
  prize_type:  'XP',
  prize_value: 100,
  rarity:      'COMMON',
  weight:      10,
  color:       '#6366f1',
  emoji:       '',
  sort_order:  0,
}

const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

export default function RuedaAdminClient({ prizes: initialPrizes }: { prizes: Prize[] }) {
  const [prizes,    setPrizes]    = useState(initialPrizes)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [isPending, start]        = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() {
    setForm({ ...EMPTY_FORM, sort_order: prizes.length + 1 })
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(p: Prize) {
    setForm({
      name:        p.name,
      description: p.description,
      prize_type:  p.prize_type,
      prize_value: p.prize_value,
      rarity:      p.rarity,
      weight:      p.weight,
      color:       p.color,
      emoji:       p.emoji,
      sort_order:  p.sort_order,
    })
    setEditId(p.id)
    setShowForm(true)
  }

  function handleSubmit() {
    start(async () => {
      const data = {
        name:        form.name,
        description: form.description,
        prize_type:  form.prize_type,
        prize_value: Number(form.prize_value),
        rarity:      form.rarity,
        weight:      Number(form.weight),
        color:       form.color,
        emoji:       form.emoji,
        sort_order:  Number(form.sort_order),
      }

      if (editId) {
        const r = await updateWheelPrize(editId, data)
        if (!r.error) {
          setPrizes(prev => prev.map(p => p.id === editId ? { ...p, ...data } : p))
          setShowForm(false)
        }
      } else {
        const r = await createWheelPrize(data)
        if (!r.error) {
          // Reload to get new id — server revalidates
          window.location.reload()
        }
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Eliminar este premio?')) return
    setDeletingId(id)
    start(async () => {
      const r = await deleteWheelPrize(id)
      if (!r.error) setPrizes(prev => prev.filter(p => p.id !== id))
      setDeletingId(null)
    })
  }

  // Peso total para mostrar probabilidades
  const totalWeight = prizes.reduce((s, p) => s + p.weight, 0)

  return (
    <div className="space-y-4">
      <button
        onClick={openCreate}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
      >
        <Plus className="w-4 h-4" /> Nuevo premio
      </button>

      {/* Resumen de probabilidades */}
      {prizes.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Probabilidades (peso total: {totalWeight})</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {prizes.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="text-base">{p.emoji || '?'}</span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-muted-foreground">{totalWeight > 0 ? ((p.weight / totalWeight) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {prizes.length === 0 ? (
          <div className="p-12 text-center">
            <Dices className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-foreground font-bold">Sin premios</p>
            <p className="text-sm text-muted-foreground mt-1">Crea el primer premio para la rueda</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {prizes.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                {/* Color swatch + emoji */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border border-white/10"
                  style={{ background: p.color }}
                >
                  {p.emoji || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-foreground">{p.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RARITY_COLORS[p.rarity] ?? 'bg-secondary text-muted-foreground'}`}>
                      {p.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{p.prize_type}: <strong className="text-foreground">{p.prize_value}</strong></span>
                    <span>Peso: <strong className="text-foreground">{p.weight}</strong></span>
                    <span>Orden: <strong className="text-foreground">{p.sort_order}</strong></span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="p-2 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deletingId === p.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {editId ? 'Editar premio' : 'Nuevo premio'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="200 XP" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripcion</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="Ganas 200 XP" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de premio</label>
                <select value={form.prize_type} onChange={e => setForm(f => ({ ...f, prize_type: e.target.value }))} className={inputClass}>
                  {PRIZE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor</label>
                <input type="number" min={0} value={form.prize_value} onChange={e => setForm(f => ({ ...f, prize_value: Number(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Rareza</label>
                <select value={form.rarity} onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))} className={inputClass}>
                  {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Peso (probabilidad)</label>
                <input type="number" min={1} value={form.weight} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Color (hex)</label>
                <div className="flex gap-2">
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-12 rounded-lg border border-border cursor-pointer bg-secondary" />
                  <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={inputClass} placeholder="#6366f1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Emoji</label>
                <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className={inputClass} placeholder="⭐" maxLength={4} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Orden en la rueda</label>
                <input type="number" min={0} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className={inputClass} />
              </div>
            </div>

            {/* Preview */}
            {form.name && (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border border-white/10" style={{ background: form.color }}>
                  {form.emoji || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{form.name}</p>
                  <p className="text-xs text-muted-foreground">{form.prize_type}: {form.prize_value} · Peso: {form.weight}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !form.name}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editId ? 'Guardar cambios' : 'Crear premio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
