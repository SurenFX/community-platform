'use client'
import StreakFlame from '@/components/ui/StreakFlame'

import { useState } from 'react'
import { getLevelColor, getLevelTitle, xpForCurrentLevel, xpForNextLevel } from '@/lib/utils'
import type { Profile, UserReputation } from '@/types/database'
import PrestigeModal, { PrestigeBadge } from '@/components/profile/PrestigeModal'
import { PRESTIGE_LEVEL } from '@/lib/constants'

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

interface Props {
  profile: (Profile & {
    user_reputation:       UserReputation | null
    equipped_border_color?: string | null
    equipped_name_emoji?:   string | null
    equipped_title_override?: string | null
  }) | null
  myRank: number
}

export default function PlayerCard({ profile, myRank }: Props) {
  const [showPrestige, setShowPrestige] = useState(false)
  const [prestigeLevel, setPrestigeLevel] = useState((profile?.user_reputation as any)?.prestige_level ?? 0)
  const rep     = profile?.user_reputation
  const level   = rep?.level         ?? 1
  const totalXp = rep?.total_xp      ?? 0
  const streak  = rep?.current_streak ?? 0
  const sc      = rep?.salchi_coins  ?? 0

  const currentLvXp = xpForCurrentLevel(level)
  const nextLvXp    = xpForNextLevel(level)
  const progressPct = nextLvXp > currentLvXp
    ? Math.min(((totalXp - currentLvXp) / (nextLvXp - currentLvXp)) * 100, 100)
    : 100
  const xpNeeded = Math.max(0, nextLvXp - totalXp)

  const username   = profile?.username ?? '?'
  const avatarUrl  = profile?.avatar_url
  const title      = getLevelTitle(level)
  const levelColor = getLevelColor(level)
  const borderHex  = profile?.equipped_border_color
    ? (BORDER_COLOR_HEX[profile.equipped_border_color] ?? null)
    : null
  const nameEmoji    = profile?.equipped_name_emoji ?? null
  const titleOverride = profile?.equipped_title_override ?? null

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5"
      style={{ boxShadow: '0 0 40px hsl(185 100% 45% / 0.07)' }}
    >
      {/* Fondo radial sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 10% 0%, hsl(185 100% 45% / 0.07) 0%, transparent 55%)' }}
      />

      <div className="relative flex items-center gap-4 mb-5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden"
            style={{
              outline: borderHex
                ? `3px solid ${borderHex}`
                : '2px solid hsl(185 100% 45% / 0.35)',
              outlineOffset: '2px',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-black text-2xl">{username[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>
          {/* LVL badge */}
          <div
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black whitespace-nowrap"
            style={{ boxShadow: '0 0 10px hsl(185 100% 45% / 0.55)' }}
          >
            LVL {level}
          </div>
        </div>

        {/* Nombre + título + online */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <h1 className="text-xl font-black text-foreground truncate">{username}</h1>
            {nameEmoji && <span className="text-base leading-none">{nameEmoji}</span>}
            {prestigeLevel > 0 && <PrestigeBadge prestige={prestigeLevel} />}
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              En línea
            </span>
          </div>
          <p className={`text-sm font-bold ${levelColor}`}>{titleOverride ?? title}</p>
        </div>
      </div>

      {/* Barra de XP — estilo HP bar */}
      <div className="relative mb-4">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className={`font-bold ${levelColor}`}>NV {level}</span>
          <span className="text-muted-foreground">
            {totalXp.toLocaleString('es-AR')} / {nextLvXp.toLocaleString('es-AR')} XP
          </span>
          <span className="font-semibold text-muted-foreground">NV {level + 1}</span>
        </div>
        <div className="h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 xp-bar"
            style={{
              width: `${progressPct}%`,
              boxShadow: '0 0 10px hsl(185 100% 45% / 0.6)',
            }}
          />
        </div>
        {xpNeeded > 0 && (
          <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">
            {xpNeeded.toLocaleString('es-AR')} XP para el siguiente nivel
          </p>
        )}
      </div>

      {/* Prestige disponible */}
      {level >= PRESTIGE_LEVEL && (
        <button
          onClick={() => setShowPrestige(true)}
          className="w-full mb-3 py-2.5 rounded-xl text-sm font-bold border border-yellow-400/40 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-all flex items-center justify-center gap-2"
          style={{ animation: 'tier-pulse 3s ease-in-out infinite' }}
        >
          👑 Prestige disponible — nivel {PRESTIGE_LEVEL} alcanzado
        </button>
      )}

      {showPrestige && (
        <PrestigeModal
          currentPrestige={prestigeLevel}
          onClose={() => setShowPrestige(false)}
          onSuccess={(p) => { setPrestigeLevel(p); setShowPrestige(false) }}
        />
      )}

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Racha</p>
          <p className="text-sm font-black text-orange-400">🔥 {streak}d</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">SalchiCoins</p>
          <p className="text-sm font-black text-yellow-400">🪙 {sc.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Ranking</p>
          <p className="text-sm font-black text-primary">🏆 #{myRank}</p>
        </div>
      </div>
    </div>
  )
}
