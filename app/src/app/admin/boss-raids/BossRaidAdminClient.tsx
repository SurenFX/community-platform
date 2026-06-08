'use client'

import { useState, useTransition } from 'react'
import { Skull, Plus, Loader2 } from 'lucide-react'
import { createBossRaid } from '@/app/actions/admin'

interface BossRaid {
  id: string; name: string; emoji: string; max_hp: number; current_hp: number
  status: string; phase: number; ends_at: string; reward_xp: number; reward_sc: number
}

export default function BossRaidAdminClient({ raids }: { raids: BossRaid[] }) {
  const [name,     setName]     = useState('')
  const [emoji,    setEmoji]    = useState('👹')
  const [lore,     setLore]     = useState('')
  const [maxHp,    setMaxHp]    = useState('10000')
  const [rewardXp, setRewardXp] = useState('500')
  const [rewardSc, setRewardSc] = useState('50')
  const [hours,    setHours]    = useState('48')
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  function handleCreate() {
    if (!name.trim()) return
    setError(null)
    start(async () => {
      const r = await createBossRaid({
        name: name.trim(), emoji, lore, max_hp: Number(maxHp),
        reward_xp: Number(rewardXp), reward_sc: Number(rewardSc),
        duration_hours: Number(hours),
      })
      if (r.error) setError(r.error)
      else { setName(''); setLore('') }
    })
  }

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE:   'text-green-400',
    DEFEATED: 'text-primary',
    EXPIRED:  'text-muted-foreground',
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Skull className="w-6 h-6 text-red-400" /> Boss Raids
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Crear y gestionar boss raids comunitarios</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-bold text-foreground">Nuevo Boss Raid</p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Nombre del boss</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="El Gran Salchidor"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Emoji</label>
            <input value={emoji} onChange={e => setEmoji(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">HP total</label>
            <input type="number" value={maxHp} onChange={e => setMaxHp(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Lore (opcional)</label>
            <textarea value={lore} onChange={e => setLore(e.target.value)} rows={2}
              placeholder="Una leyenda oscura..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Recompensa XP</label>
            <input type="number" value={rewardXp} onChange={e => setRewardXp(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Recompensa SC</label>
            <input type="number" value={rewardSc} onChange={e => setRewardSc(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Duracion (horas)</label>
            <input type="number" value={hours} onChange={e => setHours(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={isPending || !name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-xl text-sm font-bold transition-all disabled:opacity-40">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear Boss Raid
        </button>
      </div>

      <div className="space-y-3">
        {raids.map(r => {
          const hpPct = Math.max(0, Math.round((r.current_hp / r.max_hp) * 100))
          return (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <span className="text-3xl">{r.status === 'DEFEATED' ? '💀' : r.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-foreground">{r.name}</span>
                  <span className={`text-[10px] font-bold ${STATUS_COLOR[r.status] ?? 'text-muted-foreground'}`}>{r.status}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden w-40">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${r.status === 'DEFEATED' ? 0 : hpPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {r.current_hp.toLocaleString('es-AR')} / {r.max_hp.toLocaleString('es-AR')} HP
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <p>Fase {r.phase}</p>
                <p>{new Date(r.ends_at).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
          )
        })}
        {raids.length === 0 && <p className="text-sm text-muted-foreground">Sin boss raids creados.</p>}
      </div>
    </div>
  )
}
