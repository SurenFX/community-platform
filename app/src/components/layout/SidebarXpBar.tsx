'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLevelColor, getLevelTitle, xpForCurrentLevel, xpForNextLevel } from '@/lib/utils'
import type { UserReputation } from '@/types/database'

interface SidebarXpBarProps {
  userId:     string
  initialRep: UserReputation | null
  username:   string
  avatarUrl:  string | null
  compact?:   boolean
}

export default function SidebarXpBar({ userId, initialRep, username, avatarUrl, compact }: SidebarXpBarProps) {
  const [rep,      setRep]      = useState(initialRep)
  const [flashing, setFlashing] = useState(false)
  const prevXpRef = useRef(initialRep?.total_xp ?? 0)

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

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span className={`font-medium ${getLevelColor(level)}`}>Nv. {level} — {getLevelTitle(level)}</span>
          <span>{totalXp.toLocaleString('es-AR')} XP</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full xp-bar rounded-full transition-all duration-700 ${flashing ? 'xp-bar-flash' : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full ring-2 ring-primary/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">{username[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
            <span className="text-[9px] font-bold text-foreground leading-none">{level}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{username}</p>
          <p className={`text-xs font-medium ${getLevelColor(level)}`}>{getLevelTitle(level)}</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{totalXp.toLocaleString('es-AR')} XP</span>
          <span>Nv. {level} → {level + 1}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full xp-bar rounded-full transition-all duration-700 ${flashing ? 'xp-bar-flash' : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
