'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getLevelColor, getLevelTitle, xpForCurrentLevel, xpForNextLevel, getRankTier } from '@/lib/utils'
import type { UserReputation } from '@/types/database'
import LevelUpModal from '@/components/profile/LevelUpModal'
import RankUpModal from '@/components/profile/RankUpModal'

interface SidebarXpBarProps {
  userId:        string
  initialRep:    UserReputation | null
  username:      string
  avatarUrl:     string | null
  compact?:      boolean
  avatarStyle?:  React.CSSProperties
  nameEmoji?:    string | null
  onAvatarClick?: () => void
}

export default function SidebarXpBar({ userId, initialRep, username, avatarUrl, compact, avatarStyle, nameEmoji, onAvatarClick }: SidebarXpBarProps) {
  const [rep,        setRep]        = useState(initialRep)
  const [flashing,   setFlashing]   = useState(false)
  const [levelUp,    setLevelUp]    = useState<number | null>(null)
  const [rankUp,     setRankUp]     = useState<{ newLevel: number; prevLevel: number } | null>(null)
  const prevXpRef    = useRef(initialRep?.total_xp ?? 0)
  const prevLevelRef = useRef(initialRep?.level ?? 1)
  const prevTierRef  = useRef(getRankTier(initialRep?.level ?? 1).label)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`sidebar-rep:${userId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'user_reputation',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const newRep = payload.new as UserReputation
        if (newRep.total_xp > prevXpRef.current) {
          prevXpRef.current = newRep.total_xp
          setFlashing(true)
          setTimeout(() => setFlashing(false), 1000)
        }
        if (newRep.level > prevLevelRef.current) {
          const newTierLabel = getRankTier(newRep.level).label
          if (newTierLabel !== prevTierRef.current) {
            setRankUp({ newLevel: newRep.level, prevLevel: prevLevelRef.current })
            prevTierRef.current = newTierLabel
          } else {
            setLevelUp(newRep.level)
          }
          prevLevelRef.current = newRep.level
        }
        setRep(newRep)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const level       = rep?.level ?? 1
  const totalXp     = rep?.total_xp ?? 0
  const currentLvXp = xpForCurrentLevel(level)
  const nextLvXp    = xpForNextLevel(level)
  const progressPct = nextLvXp > currentLvXp
    ? Math.min(((totalXp - currentLvXp) / (nextLvXp - currentLvXp)) * 100, 100)
    : 100
  const tier = getRankTier(level)

  if (compact) {
    return (
      <>
        {levelUp  && <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />}
        {rankUp   && <RankUpModal newLevel={rankUp.newLevel} prevLevel={rankUp.prevLevel} onClose={() => setRankUp(null)} />}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className={`font-medium ${getLevelColor(level)}`}>Nv. {level}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${tier.color} ${tier.bg} ${tier.border}`}>
                {tier.label}
              </span>
            </div>
            <span>{totalXp.toLocaleString('es-AR')} XP</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full xp-bar rounded-full transition-all duration-700 ${flashing ? 'xp-bar-flash' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
    {levelUp  && <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />}
    {rankUp   && <RankUpModal newLevel={rankUp.newLevel} prevLevel={rankUp.prevLevel} onClose={() => setRankUp(null)} />}
    <div className="flex flex-col gap-3">
      <Link
        href={`/dashboard/profile/${username}`}
        onClick={onAvatarClick}
        className="flex items-center gap-3 group rounded-xl hover:bg-secondary/60 transition-all p-1 -m-1"
      >
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="w-10 h-10 rounded-xl transition-all"
              style={avatarStyle ?? { border: '2px solid hsl(var(--border))' }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center transition-all"
              style={avatarStyle ?? { border: '2px solid hsl(var(--border))' }}
            >
              <span className="text-primary font-bold text-sm">{username[0]?.toUpperCase()}</span>
            </div>
          )}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-black whitespace-nowrap leading-none"
            style={{ boxShadow: '0 0 8px hsl(185 100% 45% / 0.5)' }}
          >
            LVL {level}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {nameEmoji && <span className="mr-1">{nameEmoji}</span>}
            {username}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className={`text-xs font-medium ${getLevelColor(level)}`}>{getLevelTitle(level)}</p>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${tier.color} ${tier.bg} ${tier.border}`}>
              {tier.label}
            </span>
          </div>
        </div>
      </Link>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{totalXp.toLocaleString('es-AR')} XP</span>
          <span>Nv. {level} a {level + 1}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full xp-bar rounded-full transition-all duration-700 ${flashing ? 'xp-bar-flash' : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
    </>
  )
}
