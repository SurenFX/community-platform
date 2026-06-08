'use client'

import { PrestigeBadge } from '@/components/profile/PrestigeModal'

import { useState } from 'react'
import Link from 'next/link'
import { cn, getLevelColor, getLevelTitle, formatNumber, getRankTier } from '@/lib/utils'
import { Trophy, Medal, User, ChevronDown, Search, Users, Shield } from 'lucide-react'
import StreakFlame from '@/components/ui/StreakFlame'

type Period = 'total_xp' | 'weekly_xp' | 'monthly_xp'

interface Entry {
  user_id:        string
  total_xp:       number
  weekly_xp:      number
  monthly_xp:     number
  level:          number
  current_streak: number
  profiles:       {
    username:               string
    avatar_url:             string | null
    equipped_border_color?: string | null
    equipped_name_emoji?:   string | null
    equipped_title_override?: string | null
  } | null
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
  seasonName?:   string | null
}

const BORDER_COLOR_HEX: Record<string, string> = {
  'cyan-400':   '#22d3ee',
  'green-400':  '#4ade80',
  'violet-400': '#a78bfa',
  'red-500':    '#ef4444',
  'pink-400':   '#f472b6',
  'yellow-400': '#facc15',
  'orange-400': '#fb923c',
  'purple-500': '#a855f7',
}

function RankTierBadge({ level }: { level: number }) {
  const tier = getRankTier(level)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border',
      tier.color, tier.bg, tier.border
    )}>
      <Shield className="w-2.5 h-2.5" />
      {tier.label}
    </span>
  )
}

export default function LeaderboardTable({ entries, currentUserId, myRank, seasonName }: LeaderboardTableProps) {
  const [period, setPeriod] = useState<Period>('total_xp')
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const periodLabels: Record<Period, string> = {
    total_xp:   'Global',
    weekly_xp:  'Esta semana',
    monthly_xp: seasonName ?? 'Este mes',
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

  const top3 = sorted.slice(0, 3)
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
  const podiumHeights = ['h-20', 'h-28', 'h-16']
  const podiumColors  = ['bg-slate-400/20 border-slate-400/40', 'bg-yellow-400/20 border-yellow-400/50', 'bg-amber-700/20 border-amber-700/40']
  const podiumEmojis  = ['', '', '']
  const podiumTextColors = ['text-slate-300', 'text-yellow-400', 'text-amber-600']

  return (
    <div className="space-y-3">
      {/* Podio top 3 */}
      {!search && sorted.length >= 3 && (
        <div className="bg-card border border-border rounded-2xl p-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <p className="text-xs font-bold text-muted-foreground text-center mb-5 tracking-widest uppercase">Podio</p>
          <div className="flex items-end justify-center gap-3">
            {podiumOrder.map((entry, podiumIdx) => {
              if (!entry) return null
              const realRank = sorted.indexOf(entry) + 1
              const xp       = entry[period]
              const username = entry.profiles?.username ?? '?'
              const borderHex = BORDER_COLOR_HEX[entry.profiles?.equipped_border_color ?? '']
              const isCenter  = podiumIdx === 1
              return (
                <div key={entry.user_id} className={`flex flex-col items-center gap-2 ${isCenter ? 'scale-105' : ''}`} style={{ flex: isCenter ? '0 0 38%' : '0 0 28%' }}>
                  {realRank === 1 && (
                    <div className="text-2xl animate-bounce" style={{ animationDuration: '2s' }}></div>
                  )}
                  <div className="relative">
                    {entry.profiles?.avatar_url ? (
                      <img
                        src={entry.profiles.avatar_url}
                        alt={username}
                        className={`rounded-2xl object-cover ${isCenter ? 'w-16 h-16' : 'w-12 h-12'}`}
                        style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 16px ${borderHex}60` } : {}}
                      />
                    ) : (
                      <div
                        className={`rounded-2xl bg-primary/20 flex items-center justify-center font-black text-primary ${isCenter ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-lg'}`}
                        style={borderHex ? { border: `3px solid ${borderHex}`, boxShadow: `0 0 16px ${borderHex}60` } : {}}
                      >
                        {username[0].toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1.5 -right-1.5 text-sm">{podiumEmojis[podiumIdx]}</span>
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className={`text-xs font-black truncate ${podiumTextColors[podiumIdx]}`}>{username}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">{formatNumber(xp)} XP</p>
                  </div>
                  <div className={`w-full border rounded-t-xl ${podiumColors[podiumIdx]} ${podiumHeights[podiumIdx]} flex items-center justify-center`}>
                    <span className={`text-2xl font-black ${podiumTextColors[podiumIdx]}`}>#{realRank}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar usuario..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
        />
      </div>

    <div className="bg-card border border-border rounded-xl overflow-hidden">
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

      <div className="divide-y divide-border">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            {query ? (
              <>
                <Search className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
                <p className="text-foreground font-semibold mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No hay usuarios con ese nombre.</p>
              </>
            ) : (
              <>
                <Users className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
                <p className="text-foreground font-semibold mb-1">Sin miembros aun</p>
                <p className="text-sm text-muted-foreground">El ranking aparecera cuando haya actividad.</p>
              </>
            )}
          </div>
        ) : (
          visible.map((entry) => {
            const rank          = sorted.indexOf(entry) + 1
            const isCurrentUser = entry.user_id === currentUserId
            const xp            = entry[period]
            const username      = entry.profiles?.username
            const topGlow       = rank === 1 ? 'bg-yellow-400/5' : rank === 2 ? 'bg-slate-400/5' : rank === 3 ? 'bg-amber-600/5' : ''
            const isHovered     = hoveredId === entry.user_id
            const borderHex     = BORDER_COLOR_HEX[entry.profiles?.equipped_border_color ?? '']
            const borderStyle   = borderHex ? { border: `2.5px solid ${borderHex}`, boxShadow: `0 0 8px ${borderHex}50` } : undefined

            const inner = (
              <>
                <div className="w-8 flex justify-center shrink-0">
                  {rank === 1 ? <Trophy className="w-5 h-5 text-yellow-400" />
                    : rank === 2 ? <Medal className="w-5 h-5 text-slate-400" />
                    : rank === 3 ? <Medal className="w-5 h-5 text-amber-600" />
                    : <span className="text-sm font-bold text-muted-foreground">{rank}</span>}
                </div>

                {entry.profiles?.avatar_url ? (
                  <img src={entry.profiles.avatar_url} alt={entry.profiles.username}
                    className="w-9 h-9 rounded-full shrink-0"
                    style={borderStyle} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0"
                    style={borderStyle}>
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {entry.profiles?.equipped_name_emoji && (
                        <span className="mr-1">{entry.profiles.equipped_name_emoji}</span>
                      )}
                      {entry.profiles?.username ?? 'Usuario'}
                    </p>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Tu</span>
                    )}
                    {(entry as any).prestige_level > 0 && <PrestigeBadge prestige={(entry as any).prestige_level} />}
                    {entry.current_streak >= 2 && <StreakFlame days={entry.current_streak} />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className={cn('text-xs font-medium', getLevelColor(entry.level))}>
                      Nv. {entry.level} {entry.profiles?.equipped_title_override ?? getLevelTitle(entry.level)}
                    </p>
                    <RankTierBadge level={entry.level} />
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                  <p className="text-sm font-bold text-foreground">{formatNumber(xp)}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">XP</p>
                    {(entry as any).rank_delta !== undefined && (entry as any).rank_delta !== 0 && (
                      <span className={`text-[10px] font-bold ${(entry as any).rank_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(entry as any).rank_delta > 0 ? `+${(entry as any).rank_delta}` : (entry as any).rank_delta}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )

            return isCurrentUser || !username ? (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 px-6 py-4 bg-primary/5 border-l-2 border-l-primary ${topGlow}`}
              >
                {inner}
              </div>
            ) : (
              <Link
                key={entry.user_id}
                href={`/dashboard/profile/${username}`}
                className={cn(
                  'row-hover flex items-center gap-4 px-6 py-4 transition-colors',
                  topGlow,
                  isHovered && 'bg-secondary/40'
                )}
                onMouseEnter={() => setHoveredId(entry.user_id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {inner}
              </Link>
            )
          })
        )}
      </div>

      {!isInTopList && myRank && myPosition && !query && (
        <>
          <div className="flex items-center gap-2 px-6 py-2 bg-secondary/40">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tu posicion</span>
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
                <p className="text-sm font-semibold text-foreground">Tu</p>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Tu</span>
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
    </div>
  )
}
