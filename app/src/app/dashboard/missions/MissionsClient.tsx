'use client'

import { useState, useTransition } from 'react'
import { Target, CheckCircle2, Gift, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mission, UserMission } from '@/types/database'
import { claimMission } from '@/app/actions/missions'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DAILY:   { label: 'Diaria',   color: 'bg-blue-400/15 text-blue-400'    },
  WEEKLY:  { label: 'Semanal',  color: 'bg-purple-400/15 text-purple-400' },
  SPECIAL: { label: 'Especial', color: 'bg-amber-400/15 text-amber-400'  },
  EVENT:   { label: 'Evento',   color: 'bg-pink-400/15 text-pink-400'    },
}

const PLATFORM_FROM_OBJECTIVE: Record<string, { label: string; color: string; bg: string }> = {
  DISCORD_MESSAGE:           { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_REACTION_RECEIVED: { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_REACTION_GIVEN:    { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_HELPED_USER:       { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_VOICE_TIME:        { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_JOIN:              { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  TWITCH_CHAT_MESSAGE:       { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_WATCH_TIME:         { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_FOLLOW:             { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_SUBSCRIBE:          { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_GIFT_SUB:           { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_RAID_PARTICIPATE:   { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  YOUTUBE_COMMENT:           { label: 'YouTube',  color: 'text-red-400',    bg: 'bg-red-400/15'    },
  YOUTUBE_SUBSCRIBE:         { label: 'YouTube',  color: 'text-red-400',    bg: 'bg-red-400/15'    },
  TELEGRAM_MESSAGE:          { label: 'Telegram', color: 'text-[#26A5E4]',  bg: 'bg-[#26A5E4]/15' },
  TELEGRAM_JOIN:             { label: 'Telegram', color: 'text-[#26A5E4]',  bg: 'bg-[#26A5E4]/15' },
  TELEGRAM_REACTION:         { label: 'Telegram', color: 'text-[#26A5E4]',  bg: 'bg-[#26A5E4]/15' },
}

type Tab = 'active' | 'claim' | 'completed'

interface Props {
  missions:     Mission[]
  userMissions: UserMission[]
  userId:       string
}

export default function MissionsClient({ missions, userMissions, userId }: Props) {
  const [tab, setTab] = useState<Tab>('active')
  const [localUserMissions, setLocalUserMissions] = useState<UserMission[]>(userMissions)
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())

  const progressMap = new Map(localUserMissions.map(um => [um.mission_id, um]))

  // Misiones activas: todas las que no están completadas/reclamadas
  // Ordenadas: en progreso primero, luego no iniciadas
  const active = missions
    .filter(m => {
      const um = progressMap.get(m.id)
      if (!um) return true
      return !um.is_completed
    })
    .sort((a, b) => {
      const pa = progressMap.get(a.id)?.progress ?? 0
      const pb = progressMap.get(b.id)?.progress ?? 0
      return pb - pa  // mayor progreso primero
    })

  const toClaim = missions.filter(m => {
    if ((m as any)._expired_unclaimed) return false
    const um = progressMap.get(m.id)
    return um && um.is_completed && !um.is_claimed && !claimedIds.has(um.id)
  })

  const completed = missions.filter(m => {
    if ((m as any)._expired_unclaimed) return true   // expiradas van aquí
    const um = progressMap.get(m.id)
    return um && um.is_completed && (um.is_claimed || claimedIds.has(um.id))
  })

  function handleClaim(userMissionId: string) {
    if (actionId !== null) return
    setActionId(userMissionId)
    startTransition(async () => {
      const result = await claimMission(userMissionId)
      if (!result.error) {
        setClaimedIds(prev => new Set([...prev, userMissionId]))
        setLocalUserMissions(prev =>
          prev.map(um => um.id === userMissionId ? { ...um, is_claimed: true } : um)
        )
      }
      setActionId(null)
    })
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active',    label: 'Quests activas', count: active.length    },
    { key: 'claim',     label: 'Por reclamar',   count: toClaim.length  },
    { key: 'completed', label: 'Completadas',     count: completed.length },
  ]

  function MissionCard({ mission, userMission, showClaim }: {
    mission:      Mission
    userMission?: UserMission
    showClaim?:   boolean
  }) {
    const isExpiredUnclaimed = !!(mission as any)._expired_unclaimed
    const progress    = userMission?.progress ?? 0
    const isCompleted = userMission?.is_completed ?? false
    const isClaimed   = userMission?.is_claimed || claimedIds.has(userMission?.id ?? '')
    const hasStarted  = !!userMission
    const pct         = mission.target_count > 0 ? Math.min((progress / mission.target_count) * 100, 100) : 0
    const type        = TYPE_LABELS[mission.type]
    const platform    = PLATFORM_FROM_OBJECTIVE[mission.objective_type]
    const msLeft      = new Date(mission.ends_at).getTime() - Date.now()
    const hoursLeft   = Math.ceil(msLeft / 3600000)
    const endsIn      = Math.ceil(msLeft / 86400000)
    const isExpiringSoon = !isExpiredUnclaimed && !isCompleted && msLeft > 0 && hoursLeft <= 24
    const isActioning = actionId === userMission?.id

    return (
      <div className={cn(
        'bg-card border rounded-xl p-5 transition-all',
        isExpiredUnclaimed ? 'border-border opacity-50' :
        isClaimed          ? 'border-green-500/30 bg-green-500/5 opacity-70' :
        isCompleted        ? 'border-yellow-400/40 bg-yellow-400/5' :
        isExpiringSoon     ? 'border-orange-400/40 bg-orange-400/5' :
        !hasStarted        ? 'border-border opacity-60' :
        'border-border'
      )}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${type?.color}`}>
                {type?.label}
              </span>
              {platform && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${platform.bg} ${platform.color}`}>
                  {platform.label}
                </span>
              )}
              {isExpiringSoon && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-400/15 text-orange-400 flex items-center gap-1 pulse-soft">
                  ⚠️ Expira en {hoursLeft}h
                </span>
              )}
              {isExpiredUnclaimed && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/15 text-red-400">
                  Expirada sin reclamar
                </span>
              )}
              {!isExpiredUnclaimed && isClaimed && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-500/15 text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Reclamada
                </span>
              )}
              {!hasStarted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  No iniciada
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground">{mission.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{mission.description}</p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <p className="text-base font-bold text-purple-400">+{mission.xp_reward} XP</p>
            {(mission as any).coin_reward > 0 && (
              <p className="text-xs font-semibold text-yellow-400">+{(mission as any).coin_reward} SC</p>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress} / {mission.target_count}</span>
            {!isExpiringSoon && endsIn <= 365 && <span>Vence en {endsIn}d</span>}
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isClaimed ? 'bg-green-400' : isCompleted ? 'bg-yellow-400' : 'xp-bar'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Botón reclamar */}
        {showClaim && !isClaimed && !isExpiredUnclaimed && userMission && (
          <button
            onClick={() => handleClaim(userMission.id)}
            disabled={isActioning}
            className="w-full mt-1 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-sm font-bold text-black transition-all flex items-center justify-center gap-2"
          >
            {isActioning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Gift className="w-4 h-4" />
            }
            Reclamar recompensa
          </button>
        )}
      </div>
    )
  }

  const currentList = tab === 'active' ? active : tab === 'claim' ? toClaim : completed

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Misiones</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Completá misiones para ganar XP y SalchiCoins. Se activan solas cuando empezás a participar.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                key === 'claim'
                  ? 'bg-yellow-400/20 text-yellow-400'
                  : 'bg-primary/20 text-primary'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {currentList.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          {tab === 'claim' ? (
            <>
              <Gift className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-foreground font-semibold mb-1">Nada por reclamar</p>
              <p className="text-sm text-muted-foreground">Completá misiones para ver tus recompensas acá.</p>
            </>
          ) : tab === 'completed' ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-60" />
              <p className="text-foreground font-semibold mb-1">Sin misiones completadas aún</p>
              <p className="text-sm text-muted-foreground">Las misiones reclamadas aparecerán acá.</p>
            </>
          ) : (
            <>
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-foreground font-semibold mb-1">Sin misiones activas</p>
              <p className="text-sm text-muted-foreground">Participá en Discord, Twitch, YouTube o Telegram para activar misiones.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {currentList.map((mission, i) => (
            <div key={mission.id} className="fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
              <MissionCard
                mission={mission}
                userMission={progressMap.get(mission.id)}
                showClaim={tab === 'claim'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
