'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn, getLevelColor, getLevelTitle, formatNumber } from '@/lib/utils'
import { Trophy, Medal, User, ChevronDown } from 'lucide-react'

type Period = 'total_xp' | 'weekly_xp' | 'monthly_xp'

interface Entry {
  user_id:    string
  total_xp:   number
  weekly_xp:  number
  monthly_xp: number
  level:      number
  profiles:   { username: string; avatar_url: string | null } | null
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
  const [period, setPeriod] = useState<Period>('total_xp')

  const sorted = [...entries].sort((a, b) => b[period] - a[period])

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

  // El usuario está en el top visible si aparece en la lista
  const isInTopList = sorted.some(e => e.user_id === currentUserId)
  const myPosition = myRank ? (myRank[rankField[period]] as number) : null

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

      {/* Table */}
      <div className="divide-y divide-border">
        {sorted.map((entry, index) => {
          const rank          = index + 1
          const isCurrentUser = entry.user_id === currentUserId
          const xp            = entry[period]

          const username = entry.profiles?.username
          const topGlow = rank === 1 ? 'bg-yellow-400/5' : rank === 2 ? 'bg-slate-400/5' : rank === 3 ? 'bg-amber-600/5' : ''
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
        })}
      </div>

      {/* Mi posición — solo si no estoy en la lista visible */}
      {!isInTopList && myRank && myPosition && (
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
