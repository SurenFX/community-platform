'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn, getLevelColor, getLevelTitle, formatNumber } from '@/lib/utils'
import { Trophy, Medal, User, ChevronDown, Flame, Search, Users } from 'lucide-react'

type Period = 'total_xp' | 'weekly_xp' | 'monthly_xp'

interface Entry {
  user_id:        string
  total_xp:       number
  weekly_xp:      number
  monthly_xp:     number
  level:          number
  current_streak: number
  profiles:       { username: string; avatar_url: string | null } | null
}

interface MyRank {
  total_xp:   number
  weekly_xp:  number
  monthly_xp: number
  rank_total:   number
  rank_weekly:  number
  rank_monthly: number
}

interface LeaderboardTableProps {
  entries:       Entry[]
  currentUserId?: string
  myRank?:       MyRank | null
}

export default function LeaderboardTable({ entries, currentUserId, myRank }: LeaderboardTableProps) {
  const [period, setPeriod]   = useState<Period>('total_xp')
  const [search, setSearch]   = useState('')

  const periodLabels: Record<Period, string> = {
    total_xp:   'Global',
    weekly_xp:  'Esta semana',
    monthly_xp: 'Este mes',
  }

  const rankField: Record<Period, keyof MyRank> = {
    total_xp:   'rank_total',
    weekly_xp:  'rank_weekly',
    monthly_xp: 'rank_monthly',
  }

  const xpField: Record<Period, keyof MyRank> = {
    total_xp:   'total_xp',
    weekly_xp:  'weekly_xp',
    monthly_xp: 'monthly_xp',
  }

  const sorted  = [...entries].sort((a, b) => b[period] - a[period])
  const query   = search.trim().toLowerCase()
  const visible = query
    ? sorted.filter(e => e.profiles?.username?.toLowerCase().includes(query))
    : sorted

  const isInTopList = sorted.some(e => e.user_id === currentUserId)
  const myPosition  = myRank ? (myRank[rankField[period]] as number) : null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              period === p
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="divide-y divide-border">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            {query ? (
              <>
                <Search className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
                <p className="text-foreground font-semibold mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No hay ningún usuario que coincida con "{query}".</p>
              </>
            ) : (
              <>
                <Users className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
                <p className="text-foreground font-semibold mb-1">Sin miembros aún</p>
                <p className="text-sm text-muted-foreground">El ranking aparecerá cuando haya actividad.</p>
              </>
            )}
          </div>
        ) : (
          visible.map((entry, index) => {
            // rank real en el sorted total, no en el filtrado
            const rank          = sorted.indexOf(entry) + 1
            const isCurrentUser = entry.user_id === currentUserId
            const xp            = entry[period]
            const username      = entry.profiles?.username
            const topGlow       = rank === 1 ? 'bg-yellow-400/5' : rank === 2 ? 'bg-slate-400/5' : rank === 3 ? 'bg-amber-600/5' : ''

            const RowWrapper = ({ children }: { children: React.ReactNode }) =>
              !isCurrentUser && username ? (
                <Link href={`/dashboard/profile/${username}`}
                  className={`row-hover flex items-center gap-4 px-6 py-4 ${topGlow}`}>
                  {children}
                </Link>
              ) : (
                <div className={`flex items-center gap-4 px-6 py-4 bg-primary/5 border-l-2 border-l-primary ${topGlow}`}>
                  {children}
                </div>
              )

            return (
              <RowWrapper key={entry.user_id}>
                <div className="w-8 flex justify-center shrink-0">
                  {rank === 1 ? <Trophy className="w-5 h-5 text-yellow-400" />
                    : rank === 2 ? <Medal className="w-5 h-5 text-slate-400" />
                    : rank === 3 ? <Medal className="w-5 h-5 text-amber-600" />
                    : <span className="text-sm font-bold text-muted-foreground">{rank}</span>}
                </div>

                {entry.profiles?.avatar_url ? (
                  <img src={entry.profiles.avatar_url} alt={entry.profiles.username}
                    className="w-9 h-9 rounded-full shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {entry.profiles?.username ?? 'Usuario'}
                    </p>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Tú</span>
                    )}
                    {entry.current_streak >= 3 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-orange-400 font-bold">
                        <Flame className="w-3 h-3" />{entry.current_streak}
                      </span>
                    )}
                  </div>
                  <p className={cn('text-xs font-medium', getLevelColor(entry.level))}>
                    Nv. {entry.level} · {getLevelTitle(entry.level)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatNumber(xp)}</p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </RowWrapper>
            )
          })
        )}
      </div>

      {/* Mi posición — solo si no estoy en el top visible y no hay búsqueda activa */}
      {!isInTopList && myRank && myPosition && !query && (
        <>
          <div className="flex items-center gap-2 px-6 py-2 bg-secondary/40">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tu posición</span>
          </div>
          <div className="flex items-center gap-4 px-6 py-4 bg-primary/5 border-l-2 border-l-primary">
            <div className="w-8 flex justify-center shrink-0">
              <span className="text-sm font-bold text-muted-foreground">#{myPosition}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Tú</p>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Tú</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">
                {formatNumber(myRank[xpField[period]] as number)}
              </p>
              <p className="text-xs text-muted-foreground">XP</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
