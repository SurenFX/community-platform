'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, ToggleLeft, ToggleRight, Loader2, X, Check } from 'lucide-react'
import type { Mission, MissionType, XpEventType } from '@/types/database'

const TYPE_COLORS: Record<MissionType, string> = {
  DAILY:   'bg-blue-400/15 text-blue-400',
  WEEKLY:  'bg-purple-400/15 text-purple-400',
  SPECIAL: 'bg-amber-400/15 text-amber-400',
  EVENT:   'bg-pink-400/15 text-pink-400',
}

const EVENT_LABELS: Partial<Record<XpEventType, string>> = {
  DISCORD_MESSAGE:       'Mensaje en Discord',
  TWITCH_WATCH_TIME:     'Ver stream (bloques 10min)',
  TWITCH_CHAT_MESSAGE:   'Chat en Twitch',
  YOUTUBE_COMMENT:       'Comentar en YouTube',
  DISCORD_HELPED_USER:   'Ayudar en Discord',
  TWITCH_RAID_PARTICIPATE: 'Participar en raid',
}

interface MissionsAdminProps {
  missions: Mission[]
}

const EMPTY_FORM = {
  title:         '',
  description:   '',
  type:          'DAILY' as MissionType,
  objective_type:'DISCORD_MESSAGE' as XpEventType,
  target_count:  5,
  xp_reward:     50,
  ticket_reward: 0,
  starts_at:     new Date().toISOString().slice(0, 16),
  ends_at:       new Date(Date.now() + 86400000).toISOString().slice(0, 16),
}

export default function MissionsAdmin({ missions: initialMissions }: MissionsAdminProps) {
  const [missions,   setMissions]   = useState(initialMissions)
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [isPending,  startTransition] = useTransition()
  const [actionId,   setActionId]   = useState<string | null>(null)
  const supabase = createClient()

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(mission: Mission) {
    setForm({
      title:          mission.title,
      description:    mission.description,
      type:           mission.type,
      objective_type: mission.objective_type,
      target_count:   mission.target_count,
      xp_reward:      mission.xp_reward,
      ticket_reward:  mission.ticket_reward,
      starts_at:      mission.starts_at.slice(0, 16),
      ends_at:        mission.ends_at.slice(0, 16),
    })
    setEditId(mission.id)
    setShowForm(true)
  }

  async function handleSubmit() {
    startTransition(async () => {
      const data = {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at:   new Date(form.ends_at).toISOString(),
        required_platforms: [],
      }

      if (editId) {
        const { data: updated } = await supabase
          .from('missions').update(data as unknown as never).eq('id', editId).select().single() as any
        if (updated) setMissions(prev => prev.map(m => m.id === editId ? updated : m))
      } else {
        const { data: created } = await supabase
          .from('missions').insert(data as unknown as never).select().single() as any
        if (created) setMissions(prev => [created, ...prev])
      }
      setShowForm(false)
    })
  }

  async function toggleActive(mission: Mission) {
    setActionId(mission.id)
    startTransition(async () => {
      const { data: updated } = await supabase
        .from('missions')
        .update(({ is_active: !mission.is_active }) as unknown as never)
        .eq('id', mission.id)
        .select().single()
      if (updated) setMissions(prev => prev.map(m => m.id === mission.id ? updated : m))
      setActionId(null)
    })
  }

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

  return (
    <div className="space-y-4">
      <button onClick={openCreate}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl text-sm transition-all">
        <Plus className="w-4 h-4" /> Nueva misión
      </button>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {editId ? 'Editar misión' : 'Nueva misión'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Participá en Discord" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="Escribí 5 mensajes en Discord" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MissionType }))} className={inputClass}>
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="SPECIAL">Especial</option>
                  <option value="EVENT">Evento</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Objetivo</label>
                <select value={form.objective_type} onChange={e => setForm(f => ({ ...f, objective_type: e.target.value as XpEventType }))} className={inputClass}>
                  {Object.entries(EVENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cantidad objetivo</label>
                <input type="number" min={1} value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: parseInt(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">XP de recompensa</label>
                <input type="number" min={0} value={form.xp_reward} onChange={e => setForm(f => ({ ...f, xp_reward: parseInt(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tickets de recompensa</label>
                <input type="number" min={0} value={form.ticket_reward} onChange={e => setForm(f => ({ ...f, ticket_reward: parseInt(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Inicio</label>
                <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fin</label>
                <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className={inputClass} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-all">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={isPending || !form.title}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editId ? 'Guardar cambios' : 'Crear misión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de misiones */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {missions.map(mission => (
            <div key={mission.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[mission.type]}`}>
                    {mission.type}
                  </span>
                  {!mission.is_active && (
                    <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded">Inactiva</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">{mission.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mission.target_count} acciones · +{mission.xp_reward} XP
                  {mission.ticket_reward > 0 && ` · +${mission.ticket_reward} 🎟️`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(mission)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggleActive(mission)} disabled={actionId === mission.id} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                  {actionId === mission.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : mission.is_active
                      ? <ToggleRight className="w-5 h-5 text-primary" />
                      : <ToggleLeft className="w-5 h-5" />
                  }
                </button>
              </div>
            </div>
          ))}
          {missions.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">No hay misiones. Creá la primera.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
