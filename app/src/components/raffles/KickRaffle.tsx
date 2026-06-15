'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trophy, Shuffle, Users, Loader2, Radio, Play, Square } from 'lucide-react'
import { announceKickRaffleStart, announceKickRaffleWinner } from '@/app/actions/raffle'
import Link from 'next/link'

interface Entry {
  id:            string
  kick_username: string
  user_id:       string | null
  entered_at:    string
}

interface ActiveRaffle {
  id:      string
  keyword: string
  status:  string
}

type Stage = 'setup' | 'live' | 'spinning' | 'winner'

const KICK_GREEN = '#53FC18'

export default function KickRaffle({ backHref = '/dashboard/raffles' }: { backHref?: string }) {
  const [keyword,      setKeyword]      = useState('')
  const [raffle,       setRaffle]       = useState<ActiveRaffle | null>(null)
  const [entries,      setEntries]      = useState<Entry[]>([])
  const [stage,        setStage]        = useState<Stage>('setup')
  const [winner,       setWinner]       = useState<Entry | null>(null)
  const [spinningName, setSpinningName] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const spinRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Cargar sorteo activo al montar
  useEffect(() => {
    loadActiveRaffle()
  }, [])

  // Realtime: escuchar nuevas entradas
  useEffect(() => {
    if (!raffle) return

    const channel = supabase
      .channel(`kick-raffle:${raffle.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'kick_raffle_entries',
          filter: `raffle_id=eq.${raffle.id}`,
        },
        (payload) => {
          const entry = payload.new as Entry
          setEntries(prev => {
            // Evitar duplicados en el frontend
            if (prev.find(e => e.kick_username === entry.kick_username)) return prev
            return [entry, ...prev]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [raffle?.id])

  async function loadActiveRaffle() {
    const { data } = await (supabase
      .from('kick_raffles')
      .select('*')
      .eq('status', 'active')
      .single() as any) as { data: ActiveRaffle | null }

    if (data) {
      setRaffle(data)
      setStage('live')
      loadEntries(data.id)
    }
  }

  async function loadEntries(raffleId: string) {
    const { data } = await supabase
      .from('kick_raffle_entries')
      .select('*')
      .eq('raffle_id', raffleId)
      .order('entered_at', { ascending: false })

    if (data) setEntries(data)
  }

  async function startRaffle() {
    if (!keyword.trim()) {
      setError('Escribí una palabra clave')
      return
    }
    try {
      setLoading(true)
      setError(null)

      // Cerrar cualquier sorteo anterior que no esté cerrado
      await supabase
        .from('kick_raffles')
        .update({ status: 'cancelled' } as unknown as never)
        .in('status', ['active', 'drawn', 'stopped'])

      // Crear nuevo sorteo
      const { data, error: err } = await supabase
        .from('kick_raffles')
        .insert([{ keyword: keyword.trim(), status: 'active' }] as unknown as never)
        .select()
        .single() as any

      if (err) throw err

      setRaffle(data)
      setEntries([])
      setStage('live')

      // Anunciar en el chat de Kick via server action
      await announceKickRaffleStart(keyword.trim())

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function stopRaffle() {
    if (!raffle) return
    await supabase
      .from('kick_raffles')
      .update({ status: 'stopped' } as unknown as never)
      .eq('id', raffle.id)
    setStage('setup')
    setRaffle(null)
    setEntries([])
    setKeyword('')
  }

  function startSpin() {
    if (!entries.length) return
    setStage('spinning')
    setWinner(null)

    let speed = 50, elapsed = 0
    const total = 4000

    function tick() {
      const idx = Math.floor(Math.random() * entries.length)
      setSpinningName(entries[idx].kick_username)
      elapsed += speed

      if (elapsed > total * 0.6)  speed = 120
      if (elapsed > total * 0.8)  speed = 250
      if (elapsed > total * 0.92) speed = 500

      if (elapsed >= total) {
        const picked = entries[Math.floor(Math.random() * entries.length)]
        setWinner(picked)
        setSpinningName(picked.kick_username)

        // Guardar ganador en DB y anunciar en chat
        if (raffle) {
          supabase.from('kick_raffles').update({
            status:               'drawn',
            winner_kick_username: picked.kick_username,
            winner_id:            picked.user_id,
            drawn_at:             new Date().toISOString(),
          } as unknown as never).eq('id', raffle.id)

          announceKickRaffleWinner(picked.kick_username).catch(() => {})
        }

        setTimeout(() => setStage('winner'), 400)
      } else {
        spinRef.current = setTimeout(tick, speed)
      }
    }

    spinRef.current = setTimeout(tick, speed)
  }

  async function resetToSetup() {
    if (spinRef.current) clearTimeout(spinRef.current)
    // Cerrar el sorteo actual en la DB si existe
    if (raffle) {
      await supabase
        .from('kick_raffles')
        .update({ status: 'closed' } as unknown as never)
        .eq('id', raffle.id)
    }
    setStage('setup')
    setRaffle(null)
    setEntries([])
    setWinner(null)
    setKeyword('')
  }

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={backHref} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="w-6 h-6" style={{ color: KICK_GREEN }} />
            Sorteo en Kick
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Los viewers escriben la keyword en el chat para participar
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-5 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── SETUP ─────────────────────────────────────────── */}
      {stage === 'setup' && (
        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Configurar sorteo</h2>
            <p className="text-sm text-muted-foreground">
              Los viewers registrados que escriban la keyword en el chat quedarán en la lista.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Palabra clave
            </label>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startRaffle()}
              placeholder="ej: !participar"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Solo miembros registrados con Kick conectado pueden participar.
            </p>
          </div>

          <button
            onClick={startRaffle}
            disabled={loading || !keyword.trim()}
            style={{ backgroundColor: KICK_GREEN }}
            className="w-full flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {loading ? 'Iniciando...' : 'Iniciar sorteo'}
          </button>
        </div>
      )}

      {/* ── LIVE ──────────────────────────────────────────── */}
      {stage === 'live' && raffle && (
        <div className="space-y-4">

          {/* Status bar */}
          <div className="rounded-2xl p-5 flex items-center justify-between border"
            style={{ backgroundColor: `${KICK_GREEN}1A`, borderColor: `${KICK_GREEN}4D` }}>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: KICK_GREEN }} />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Sorteo activo — keyword: <span style={{ color: KICK_GREEN }}>{raffle.keyword}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Decile a tu chat que escriban <strong>{raffle.keyword}</strong> para participar
                </p>
              </div>
            </div>
            <button
              onClick={stopRaffle}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive bg-secondary hover:bg-destructive/10 border border-border px-3 py-1.5 rounded-lg transition-all"
            >
              <Square className="w-3 h-3" />
              Detener
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-foreground">{entries.length}</p>
              <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Users className="w-4 h-4" /> Participantes
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-foreground">
                {entries.length > 0 ? `${(1 / entries.length * 100).toFixed(1)}%` : '—'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Chance por persona</p>
            </div>
          </div>

          {/* Lista de participantes */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Participantes en vivo
              </p>
              <span className="text-xs text-muted-foreground">
                Se actualiza automáticamente
              </span>
            </div>

            {entries.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-muted-foreground text-sm">
                  Esperando que los viewers escriban <strong style={{ color: KICK_GREEN }}>{raffle.keyword}</strong> en el chat...
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6 text-right">{entries.length - i}</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${KICK_GREEN}33` }}>
                        <Radio className="w-4 h-4" style={{ color: KICK_GREEN }} />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {entry.kick_username}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(entry.entered_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón sortear */}
          <button
            onClick={startSpin}
            disabled={entries.length === 0}
            style={{ backgroundColor: KICK_GREEN }}
            className="w-full flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 text-black font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-lg"
          >
            <Shuffle className="w-5 h-5" />
            ¡Sortear entre {entries.length} participantes!
          </button>
        </div>
      )}

      {/* ── SPINNING ──────────────────────────────────────── */}
      {stage === 'spinning' && (
        <div className="bg-card rounded-2xl p-12 text-center space-y-6 border" style={{ borderColor: `${KICK_GREEN}4D` }}>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Sorteando...</p>
          <div className="w-20 h-20 rounded-full border-4 animate-spin mx-auto"
            style={{ borderColor: `${KICK_GREEN}4D`, borderTopColor: KICK_GREEN }} />
          <p className="text-3xl font-black text-foreground animate-pulse min-h-[2.5rem]">
            {spinningName}
          </p>
          <div className="flex items-center justify-center gap-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-2 rounded-full animate-bounce" style={{ backgroundColor: KICK_GREEN,
                height: `${8 + (i % 4) * 8}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{entries.length} participantes</p>
        </div>
      )}

      {/* ── WINNER ────────────────────────────────────────── */}
      {stage === 'winner' && winner && (
        <div className="space-y-5">
          <div className="bg-card border border-yellow-400/30 rounded-2xl p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-4">
              🎉 ¡Ganador del sorteo!
            </p>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center"
                style={{ backgroundColor: `${KICK_GREEN}33`, borderColor: `${KICK_GREEN}4D` }}>
                <Radio className="w-8 h-8" style={{ color: KICK_GREEN }} />
              </div>
              <div className="text-left">
                <p className="text-3xl font-black text-foreground">{winner.kick_username}</p>
                <p className="text-sm text-muted-foreground">participante #{entries.findIndex(e => e.id === winner.id) + 1} de {entries.length}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetToSetup}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Nuevo sorteo
            </button>
            <button
              onClick={startSpin}
              className="flex-1 flex items-center justify-center gap-2 bg-card border font-semibold py-3 rounded-xl transition-all"
              style={{ borderColor: `${KICK_GREEN}4D`, color: KICK_GREEN }}
            >
              <Shuffle className="w-4 h-4" />
              Sortear de nuevo
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
