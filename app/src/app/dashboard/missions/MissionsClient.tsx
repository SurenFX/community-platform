'use client'

import { useState } from 'react'
import { Target, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mission, UserMission } from '@/types/database'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DAILY:   { label: 'Diaria',   color: 'bg-blue-400/15 text-blue-400'   },
  WEEKLY:  { label: 'Semanal',  color: 'bg-purple-400/15 text-purple-400' },
  SPECIAL: { label: 'Especial', color: 'bg-amber-400/15 text-amber-400'  },
  EVENT:   { label: 'Evento',   color: 'bg-pink-400/15 text-pink-400'    },
}

const PLATFORM_FROM_OBJECTIVE: Record<string, { label: string; color: string; bg: string }> = {
  DISCORD_MESSAGE:           { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_REACTION_RECEIVED: { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  DISCORD_HELPED_USER:       { label: 'Discord',  color: 'text-indigo-400', bg: 'bg-indigo-400/15' },
  TWITCH_CHAT_MESSAGE:       { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_WATCH_TIME:         { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_FOLLOW:             { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_SUBSCRIBE:          { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  TWITCH_RAID_PARTICIPATE:   { label: 'Twitch',   color: 'text-purple-400', bg: 'bg-purple-400/15' },
  YOUTUBE_COMMENT:           { label: 'YouTube',  color: 'text-red-400',    bg: 'bg-red-400/15'    },
  YOUTUBE_SUBSCRIBE:         { label: 'YouTube',  color: 'text-red-400',    bg: 'bg-red-400/15'    },
  TELEGRAM_MESSAGE:          { label: 'Telegram', color: 'text-[#26A5E4]', bg: 'bg-[#26A5E4]/15' },
}

interface Props {
  missions:     Mission[]
  userMissions: UserMission[]
}

function MissionCard({ mission, userMission }: { mission: Mission; userMission?: UserMission }) {
  const progress    = userMission?.progress ?? 0
  const isCompleted = userMission?.is_completed ?? false
  const pct         = mission.target_count > 0 ? Math.min((progress / mission.target_count) * 100, 100) : 0
  const type        = TYPE_LABELS[mission.type]
  const endsIn      = Math.ceil((new Date(mission.ends_at).getTime() - Date.now()) / 86400000)

  return (
    <div className={`bg-card border rounded-xl p-6 transition-all ${
      isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-border card-hover'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${type?.color}`}>
              {type?.label}
            </span>
            {PLATFORM_FROM_OBJECTIVE[mission.objective_type] && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${PLATFORM_FROM_OBJECTIVE[mission.objective_type].bg} ${PLATFORM_FROM_OBJECTIVE[mission.objective_type].color}`}>
                {PLATFORM_FROM_OBJECTIVE[mission.objective_type].label}
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-500/15 text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Completada
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground">{mission.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{mission.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-purple-400">+{mission.xp_reward}</p>
          <p className="text-xs text-muted-foreground">XP</p>
          {(mission as any).coin_reward > 0 && (
            <p className="text-xs text-yellow-400 mt-0.5">+{(mission as any).coin_reward} SC</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress} / {mission.target_count}</span>
          {endsIn <= 365 && <span>Vence en {endsIn} día{endsIn !== 1 ? 's' : ''}</span>}
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-400' : 'xp-bar'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function MissionsClient({ missions, userMissions }: Props) {
  const [tab, setTab] = useState<'active' | 'completed'>('active')

  const progressMap = new Map(userMissions.map(um => [um.mission_id, um]))

  const active    = missions.filter(m => !progressMap.get(m.id)?.is_completed)
  const completed = missions.filter(m => progressMap.get(m.id)?.is_completed)

  const shown = tab === 'active' ? active : completed

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Misiones</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Completá misiones para ganar XP y tickets de sorteo
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('active')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'active'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          En progreso
          {active.length > 0 && (
            <span className="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
              {active.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('completed')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'completed'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Completadas
          {completed.length > 0 && (
            <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
              {completed.length}
            </span>
          )}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          {tab === 'active' ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3 opacity-60" />
              <p className="text-foreground font-semibold mb-1">¡Todo completado!</p>
              <p className="text-sm text-muted-foreground">Completaste todas las misiones disponibles.</p>
            </>
          ) : (
            <>
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-foreground font-semibold mb-1">Sin misiones completadas</p>
              <p className="text-sm text-muted-foreground">¡Completá misiones para verlas acá!</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              userMission={progressMap.get(mission.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
