'use client'

import { useState, useTransition } from 'react'
import { Sword, CheckCircle2, Scroll, Loader2, Zap, CircleDollarSign, Clock, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mission, UserMission } from '@/types/database'
import { claimMission } from '@/app/actions/missions'
import { useConfetti } from '@/hooks/useConfetti'

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
  missions:       Mission[]
  userMissions:   UserMission[]
  userId:         string
  isStreamLive:   boolean
  streamMissions: Mission[]
}

export default function MissionsClient({ missions, userMissions, userId, isStreamLive, streamMissions }: Props) {
  const [tab, setTab] = useState<Tab>('active')
  const [localUserMissions, setLocalUserMissions] = useState<UserMission[]>(userMissions)
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const { questClaim } = useConfetti()

  const progressMap = new Map(localUserMissions.map(um => [um.mission_id, um]))

  const active = missions
    .filter(m => {
      const um = progressMap.get(m.id)
      if (!um) return true
      return !um.is_completed
    })
    .sort((a, b) => {
      const pa = progressMap.get(a.id)?.progress ?? 0
      const pb = progressMap.get(b.id)?.progress ?? 0
      return pb - pa
    })

  const toClaim = missions.filter(m => {
    if ((m as any)._expired_unclaimed) return false
    const um = progressMap.get(m.id)
    return um && um.is_completed && !um.is_claimed && !claimedIds.has(um.id)
  })

  const completed = missions.filter(m => {
    if ((m as any)._expired_unclaimed) return true
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
        questClaim()
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
    const isStream    = !!mission.is_stream_only
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

    const borderClass = isExpiredUnclaimed
      ? 'border-border/30 opacity-40'
      : isClaimed
      ? 'border-green-500/30 bg-green-500/5 opacity-70'
      : isCompleted
      ? 'border-yellow-400/50 bg-yellow-400/5 shadow-[0_0_20px_rgba(251,191,36,0.08)]'
      : isExpiringSoon
      ? 'border-orange-400/40 bg-orange-400/5'
      : isStream
      ? 'border-red-500/40 bg-red-500/5'
      : !hasStarted
      ? 'border-border/50 opacity-55'
      : 'border-border hover:border-primary/30 transition-colors'

    return (
      <div className={cn('bg-card border rounded-2xl p-5 transition-all', borderClass)}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {isStream && isStreamLive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1 animate-pulse">
                  <Radio className="w-2.5 h-2.5" /> STREAM
                </span>
              )}
              {type && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${type.color}`}>
                  {type.label}
                </span>
              )}
              {platform && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${platform.bg} ${platform.color}`}>
                  {platform.label}
                </span>
              )}
              {isExpiringSoon && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-400/15 text-orange-400">
                  {hoursLeft}h restantes
                </span>
              )}
              {isExpiredUnclaimed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                  Expirada
                </span>
              )}
              {isClaimed && !isExpiredUnclaimed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Completada
                </span>
              )}
              {!hasStarted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  No iniciada
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground leading-snug">{mission.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{mission.description}</p>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 bg-purple-400/10 border border-purple-400/20 rounded-xl px-2.5 py-1">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-sm font-black text-purple-400">+{mission.xp_reward}</span>
              <span className="text-[10px] text-purple-400/70 font-medium">XP</span>
            </div>
            {(mission as any).coin_reward > 0 && (
              <div className="flex items-center gap-1 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-2.5 py-1">
                <CircleDollarSign className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-sm font-black text-yellow-400">+{(mission as any).coin_reward}</span>
                <span className="text-[10px] text-yellow-400/70 font-medium">SC</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">
              Progreso: <span className="text-foreground font-bold">{progress}</span>/{mission.target_count}
            </span>
            {!isExpiringSoon && !isExpiredUnclaimed && endsIn <= 365 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />{endsIn}d
              </span>
            )}
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                isClaimed    ? 'bg-green-400'  :
                isCompleted  ? 'bg-yellow-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' :
                'xp-bar'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!isCompleted && !isExpiredUnclaimed && (
            <p className="text-[10px] text-muted-foreground text-right">
              {pct >= 100 ? 'Listo para reclamar!' : `${Math.round(pct)}% completado`}
            </p>
          )}
        </div>

        {showClaim && !isClaimed && !isExpiredUnclaimed && userMission && (
          <button
            onClick={() => handleClaim(userMission.id)}
            disabled={isActioning}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 disabled:opacity-50 text-sm font-black text-black transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(251,191,36,0.3)]"
          >
            {isActioning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Sword className="w-4 h-4" />
            }
            Reclamar botin!
          </button>
        )}
      </div>
    )
  }

  const currentList = tab === 'active' ? active : tab === 'claim' ? toClaim : completed

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
          <Scroll className="w-6 h-6 text-primary" />
          Log de Quests
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Completa quests para ganar XP y SalchiCoins. Se activan solas cuando participas.
        </p>
      </div>

      {/* Banner de misiones de stream cuando no esta en vivo */}
      {!isStreamLive && streamMissions.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {streamMissions.length} quest{streamMissions.length > 1 ? 's' : ''} de stream disponible{streamMissions.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se activan automaticamente cuando el stream este en vivo en Twitch.
            </p>
          </div>
        </div>
      )}

      {isStreamLive && streamMissions.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 animate-pulse">
            <Radio className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-400 flex items-center gap-1.5">
              Stream en vivo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {streamMissions.length} quest{streamMissions.length > 1 ? 's' : ''} de stream activa{streamMissions.length > 1 ? 's' : ''}. Participa ahora para progresar.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5',
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

      {currentList.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          {tab === 'claim' ? (
            <>
              <Sword className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-foreground font-bold mb-1">Nada por reclamar</p>
              <p className="text-sm text-muted-foreground">Completa quests para ver tu botin aqui.</p>
            </>
          ) : tab === 'completed' ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-60" />
              <p className="text-foreground font-bold mb-1">Sin quests completadas aun</p>
              <p className="text-sm text-muted-foreground">Las quests reclamadas apareceran aqui.</p>
            </>
          ) : (
            <>
              <Scroll className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-foreground font-bold mb-1">Sin quests activas</p>
              <p className="text-sm text-muted-foreground">Participa en Discord, Twitch, YouTube o Telegram para activar quests.</p>
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
