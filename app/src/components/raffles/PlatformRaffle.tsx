'use client'

import { useState, useTransition } from 'react'
import { Trophy, Ticket, Clock, Users, Zap, Loader2, Check, Lock } from 'lucide-react'
import { enterRaffle } from '@/app/actions/social'

interface Raffle {
  id:           string
  title:        string
  description:  string
  prize:        string
  use_weighted: boolean
  min_level:    number | null
  min_xp:       number | null
  ends_at:      string
}

interface PoolEntry { raffle_id: string; tickets: number }

interface PlatformRaffleClientProps {
  raffles:   Raffle[]
  myTickets: number
  myLevel:   number
  myXp:      number
  myPools:   PoolEntry[]
  userId:    string
}

export default function PlatformRaffleClient({
  raffles, myTickets, myLevel, myXp, myPools,
}: PlatformRaffleClientProps) {
  const [tickets,   setTickets]   = useState(myTickets)
  const [pools,     setPools]     = useState<PoolEntry[]>(myPools)
  const [entering,  setEntering]  = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [amounts,   setAmounts]   = useState<Record<string, number>>({})
  const [isPending, startTransition] = useTransition()

  function getMyTickets(raffleId: string) {
    return pools.find(p => p.raffle_id === raffleId)?.tickets ?? 0
  }

  function canEnter(raffle: Raffle) {
    if (raffle.min_level && myLevel < raffle.min_level) return false
    if (raffle.min_xp    && myXp   < raffle.min_xp)    return false
    return true
  }

  function daysLeft(endsAt: string) {
    const d = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000)
    if (d <= 0)  return 'Vence hoy'
    if (d === 1) return '1 día restante'
    return `${d} días restantes`
  }

  function handleEnter(raffleId: string) {
    const amount = amounts[raffleId] ?? 1
    setEntering(raffleId)
    setError(null)
    startTransition(async () => {
      const result = await enterRaffle(raffleId, amount)
      if (result.error) {
        setError(result.error)
      } else {
        setTickets(t => t - amount)
        setPools(prev => {
          const existing = prev.find(p => p.raffle_id === raffleId)
          if (existing) return prev.map(p => p.raffle_id === raffleId ? { ...p, tickets: p.tickets + amount } : p)
          return [...prev, { raffle_id: raffleId, tickets: amount }]
        })
        setSuccess(raffleId)
        setTimeout(() => setSuccess(null), 2000)
      }
      setEntering(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sorteo de la plataforma</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Usá tus tickets para participar</p>
        </div>
        <div className="ml-auto bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-green-400" />
          <span className="text-lg font-bold text-foreground">{tickets}</span>
          <span className="text-xs text-muted-foreground">tickets</span>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {raffles.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No hay sorteos activos en este momento</p>
          <p className="text-xs text-muted-foreground mt-1">Volvé pronto — ¡los sorteos se anuncian regularmente!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {raffles.map(raffle => {
            const eligible   = canEnter(raffle)
            const myEntry    = getMyTickets(raffle.id)
            const isEntering = entering === raffle.id && isPending
            const didSucceed = success === raffle.id
            const amount     = amounts[raffle.id] ?? 1

            return (
              <div key={raffle.id}
                className={`bg-card border rounded-2xl p-6 transition-all ${
                  eligible ? 'border-border' : 'border-border opacity-70'
                }`}>

                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <h3 className="text-base font-bold text-foreground">{raffle.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{raffle.description}</p>
                    <p className="text-sm font-semibold text-primary mt-2">🎁 {raffle.prize}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {daysLeft(raffle.ends_at)}
                    </div>
                    {raffle.use_weighted && (
                      <span className="text-[10px] bg-purple-400/15 text-purple-400 px-2 py-0.5 rounded mt-1 inline-block">
                        Ponderado
                      </span>
                    )}
                  </div>
                </div>

                {/* Requisitos */}
                {(raffle.min_level || raffle.min_xp) && (
                  <div className="flex gap-3 mb-4">
                    {raffle.min_level && (
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                        myLevel >= raffle.min_level
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {myLevel >= raffle.min_level ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        Nivel {raffle.min_level}+
                      </span>
                    )}
                    {raffle.min_xp && (
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                        myXp >= raffle.min_xp
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {myXp >= raffle.min_xp ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {raffle.min_xp.toLocaleString()} XP mín.
                      </span>
                    )}
                  </div>
                )}

                {/* Mi participación actual */}
                {myEntry > 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-lg mb-3">
                    <Check className="w-3.5 h-3.5" />
                    Ya participás con {myEntry} ticket{myEntry !== 1 ? 's' : ''}
                  </div>
                )}

                {/* Controles de entrada */}
                {eligible && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
                      <button onClick={() => setAmounts(a => ({ ...a, [raffle.id]: Math.max(1, (a[raffle.id] ?? 1) - 1) }))}
                        className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-background transition-all">
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-foreground">{amount}</span>
                      <button onClick={() => setAmounts(a => ({ ...a, [raffle.id]: Math.min(tickets, (a[raffle.id] ?? 1) + 1) }))}
                        className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-background transition-all">
                        +
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">ticket{amount !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => handleEnter(raffle.id)}
                      disabled={isEntering || didSucceed || tickets < 1}
                      className="ml-auto flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm transition-all"
                    >
                      {didSucceed ? (
                        <><Check className="w-4 h-4" /> ¡Listo!</>
                      ) : isEntering ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Ticket className="w-4 h-4" /> Participar</>
                      )}
                    </button>
                  </div>
                )}

                {!eligible && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" />
                    No cumplís los requisitos para este sorteo
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">¿Cómo funcionan los tickets?</p>
        <p>Ganás tickets completando misiones y siendo activo en la comunidad.</p>
        <p>En sorteos <span className="text-purple-400">ponderados</span>, más tickets = más chances. En sorteos normales, cada participante tiene las mismas chances sin importar cuántos tickets use.</p>
      </div>
    </div>
  )
}
