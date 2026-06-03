'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatsGrid from '@/components/profile/StatsGrid'
import RecentActivity from '@/components/profile/RecentActivity'
import ActiveMissions from '@/components/missions/ActiveMissions'
import XpToast from '@/components/dashboard/XpToast'
import LevelUpModal from '@/components/dashboard/LevelUpModal'
import type { Profile, UserReputation, XpEvent, UserMission, Mission } from '@/types/database'

interface ProfileWithAll extends Profile {
  user_reputation: UserReputation | null
  user_badges: unknown[]
}

interface MissionWithData extends UserMission {
  missions: Mission | null
}

interface BadgeItem {
  id: string; slug: string; name: string; description: string
  image_url: string; tier: string; family: string; family_order: number
}

const TIER_COLORS: Record<string, string> = {
  BRONZE:    'border-amber-700/30 bg-amber-700/10',
  SILVER:    'border-slate-400/30 bg-slate-400/10',
  GOLD:      'border-yellow-400/30 bg-yellow-400/10',
  LEGENDARY: 'border-purple-400/30 bg-purple-400/10',
}

const FAMILY_LABELS: Record<string, string> = {
  discord:  '💬 Discord',
  stream:   '🟣 Stream',
  streak:   '🔥 Racha',
  level:    '⭐ Nivel',
  missions: '🎯 Misiones',
  youtube:  '📹 YouTube',
  special:  '🏅 Especiales',
}

interface DashboardClientProps {
  initialProfile:  ProfileWithAll | null
  initialEvents:   XpEvent[]
  initialMissions: MissionWithData[]
  userId:          string
  allBadges:       BadgeItem[]
  earnedBadgeIds:  string[]
}

interface XpToastData {
  id:        string
  xp:        number
  eventType: string
}

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:           'Mensaje en Discord',
  DISCORD_REACTION_RECEIVED: 'Reacción recibida',
  DISCORD_HELPED_USER:       'Ayudaste a alguien',
  TWITCH_WATCH_TIME:         'Viste el stream',
  TWITCH_CHAT_MESSAGE:       'Mensaje en chat de Twitch',
  TWITCH_RAID_PARTICIPATE:   'Raid de Twitch',
  YOUTUBE_COMMENT:           'Comentario en YouTube',
  YOUTUBE_SHARE:             'Compartiste video',
  TWITTER_SHARE:             'Compartiste en Twitter',
  MISSION_COMPLETED:         'Misión completada',
  STREAK_BONUS:              'Bonus de racha',
  BADGE_EARNED:              'Badge desbloqueado',
  ADMIN_MANUAL_GRANT:        'XP otorgado por admin',
}

export default function DashboardClient({
  initialProfile,
  initialEvents,
  initialMissions,
  userId,
  allBadges,
  earnedBadgeIds,
}: DashboardClientProps) {
  const earnedSet = new Set(earnedBadgeIds)

  // Agrupar badges por familia
  const badgesByFamily: Record<string, BadgeItem[]> = {}
  for (const badge of allBadges) {
    if (!badgesByFamily[badge.family]) badgesByFamily[badge.family] = []
    badgesByFamily[badge.family].push(badge)
  }
  const [profile,     setProfile]     = useState(initialProfile)
  const [events,      setEvents]      = useState(initialEvents)
  const [missions,    setMissions]    = useState(initialMissions)
  const [toasts,      setToasts]      = useState<XpToastData[]>([])
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number } | null>(null)

  const lastXpRef    = useRef(initialProfile?.user_reputation?.total_xp ?? 0)
  const lastLevelRef = useRef(initialProfile?.user_reputation?.level ?? 1)
  const lastEventRef        = useRef(initialEvents[0]?.id ?? '')
  const lastLevelUpShownRef = useRef(initialProfile?.user_reputation?.level ?? 1)

  const supabase = createClient()

  const addToast = useCallback((xp: number, eventType: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, xp, eventType }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ── Polling cada 8 segundos ───────────────────────────────
  useEffect(() => {
    async function poll() {
      try {
        // 1. Reputación
        const { data: rep } = await (supabase
          .from('user_reputation')
          .select('*')
          .eq('user_id', userId)
          .single() as any) as { data: import('@/types/database').UserReputation | null }

        if (rep) {
          const newXp    = rep.total_xp
          const newLevel = rep.level

          // Detectar level up — solo si no se mostró ya para este nivel
          if (newLevel > lastLevelRef.current && newLevel > lastLevelUpShownRef.current) {
            setLevelUpData({
              oldLevel: lastLevelRef.current,
              newLevel,
            })
            lastLevelUpShownRef.current = newLevel
            lastLevelRef.current = newLevel
          } else if (newLevel > lastLevelRef.current) {
            lastLevelRef.current = newLevel
          }

          // Actualizar stats si cambió el XP
          if (newXp !== lastXpRef.current) {
            lastXpRef.current = newXp
            setProfile(prev => prev ? { ...prev, user_reputation: rep } : prev)
          }
        }

        // 2. Eventos recientes — buscar nuevos desde el último conocido
        const { data: newEvents } = await (supabase
          .from('xp_events')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5) as any) as { data: import('@/types/database').XpEvent[] | null }

        if (newEvents?.length) {
          const latestId = newEvents[0].id

          if (latestId !== lastEventRef.current) {
            // Hay eventos nuevos — mostrar toasts
            const previousIdx = newEvents.findIndex(e => e.id === lastEventRef.current)
            const newOnes = previousIdx === -1 ? newEvents.slice(0, 1) : newEvents.slice(0, previousIdx)

            newOnes.reverse().forEach(event => {
              addToast(event.xp_awarded, event.event_type)
            })

            lastEventRef.current = latestId
            setEvents(newEvents)
          }
        }

      } catch (err) {
        // Silenciar errores de polling — no queremos crashes
      }
    }

    // Poll inmediato al montar y después cada 8 segundos
    poll()
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [userId])

  // ── Realtime para level ups (INSERT — funciona bien) ──────
  useEffect(() => {
    const channel = supabase
      .channel(`levelups:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'user_level_ups',
        },
        (payload) => {
          const levelUp = payload.new as { user_id: string; level: number; xp_bonus: number }
          if (levelUp.user_id !== userId) return
          // Solo mostrar si el polling aún no lo mostró para este nivel
          if (levelUp.level > lastLevelUpShownRef.current) {
            setLevelUpData({
              oldLevel: levelUp.level - 1,
              newLevel: levelUp.level,
            })
            lastLevelUpShownRef.current = levelUp.level
          }
          if (levelUp.xp_bonus > 0) {
            addToast(levelUp.xp_bonus, 'ADMIN_MANUAL_GRANT')
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const rep = profile?.user_reputation

  return (
    <div className="space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bienvenido, {profile?.username} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tu resumen de actividad y progreso
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          En vivo
        </div>
      </div>

      <StatsGrid reputation={rep} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity events={events} />
        <ActiveMissions missions={missions} />
      </div>

      {/* Badges */}
      {allBadges.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-foreground">Badges</h2>
            <span className="text-xs text-muted-foreground">
              {earnedSet.size} / {allBadges.length} desbloqueados
            </span>
          </div>
          <div className="space-y-5">
            {Object.entries(badgesByFamily).map(([family, fBadges]) => {
              const earned = fBadges.filter(b => earnedSet.has(b.id))
              return (
                <div key={family}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {FAMILY_LABELS[family] ?? family}
                    </p>
                    <span className="text-xs text-muted-foreground">{earned.length}/{fBadges.length}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {fBadges.map(badge => {
                      const isEarned = earnedSet.has(badge.id)
                      return (
                        <div key={badge.id}
                          className={`border rounded-xl p-3 flex items-center gap-3 transition-all ${
                            isEarned
                              ? TIER_COLORS[badge.tier] ?? 'border-border bg-secondary/30'
                              : 'border-border bg-secondary/20 opacity-40 grayscale'
                          }`}
                        >
                          <span className="text-2xl">{badge.image_url ?? '🏅'}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{badge.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {isEarned ? badge.description : '???'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map(toast => (
          <XpToast
            key={toast.id}
            xp={toast.xp}
            label={EVENT_LABELS[toast.eventType] ?? toast.eventType}
          />
        ))}
      </div>

      {levelUpData && (
        <LevelUpModal
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          onClose={() => setLevelUpData(null)}
        />
      )}

    </div>
  )
}
