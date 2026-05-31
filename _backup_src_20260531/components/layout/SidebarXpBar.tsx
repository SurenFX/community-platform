'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLevelColor, getLevelTitle } from '@/lib/utils'
import type { UserReputation } from '@/types/database'

interface SidebarXpBarProps {
  userId:     string
  initialRep: UserReputation | null
  username:   string
  avatarUrl:  string | null
  compact?:   boolean  // solo muestra la barra, sin avatar ni nombre
}

export default function SidebarXpBar({ userId, initialRep, username, avatarUrl, compact }: SidebarXpBarProps) {
  const [rep, setRep] = useState(initialRep)
  const supabase = createClient()

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('user_reputation')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (data) setRep(data as UserReputation)
    }, 8000)
    return () => clearInterval(interval)
  }, [userId])

  const level          = rep?.level ?? 1
  const totalXp        = rep?.total_xp ?? 0
  const currentLevelXp = Math.pow(level - 1, 2) * 100
  const nextLevelXp    = Math.pow(level, 2) * 100
  const progressPct    = nextLevelXp > currentLevelXp
    ? Math.min(((totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100, 100)
    : 100

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span className={`font-medium ${getLevelColor(level)}`}>Nv. {level} — {getLevelTitle(level)}</span>
          <span>{totalXp.toLocaleString('es-AR')} XP</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full xp-bar rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
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
          <div className="h-full xp-bar rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  )
}
