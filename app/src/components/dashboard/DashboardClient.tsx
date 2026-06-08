'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PlayerCard from '@/components/dashboard/PlayerCard'
import RecentActivity from '@/components/profile/RecentActivity'
import ActiveMissions from '@/components/missions/ActiveMissions'
import XpToast from '@/components/dashboard/XpToast'
import LevelUpModal from '@/components/dashboard/LevelUpModal'
import BadgeUnlockModal from '@/components/profile/BadgeUnlockModal'
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
  is_secret?: boolean
}

const TIER_COLORS: Record<string, string> = {
  BRONZE:    'border-amber-700/30 bg-amber-700/10',
  SILVER:    'border-slate-400/30 bg-slate-400/10',
  GOLD:      'border-yellow-400/30 bg-yellow-400/10',
  LEGENDARY: 'border-purple-400/30 bg-purple-400/10',
}

const FAMILY_LABELS: Record<string, string> = {
  discord:   '💬 Discord',
  stream:    '🟣 Stream',
  streak:    '🔥 Racha',
  level:     '⭐ Nivel',
  missions:  '🎯 Quests',
  youtube:   '📹 YouTube',
  telegram:  '✈️ Telegram',
  seniority: '🏛️ Antiguedad',
  special:   '🏅 Especiales',
}

interface DashboardClientProps {
  initialProfile:  ProfileWithAll | null
  initialEvents:   XpEvent[]
  initialMissions: MissionWithData[]
  userId:          string
  allBadges:       BadgeItem[]
  earnedBadgeIds:  string[]
  myRank:          number
}

interface XpToastData {
  id:        string
  xp:        number
  eventType: string
}

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:           'Mensaje en Discord',
  DISCORD_REACTION_RECEIVED: 'Reaccion recibida',
  DISCORD_REACTION_GIVEN:    'Reaccion dada',
  DISCORD_HELPED_USER:       'Ayudaste a alguien',
  DISCORD_VOICE_TIME:        'Tiempo en voz',
  DISCORD_JOIN:              'Te uniste al servidor',
  TWITCH_WATCH_TIME:         'Viste el stream',
  TWITCH_CHAT_MESSAGE:       'Chat en el stream',
  TWITCH_FOLLOW:             'Seguiste el canal',
  TWITCH_SUBSCRIBE:          'Sub al canal',
  TWITCH_GIFT_SUB:           'Gift sub',
  TWITCH_RAID_PARTICIPATE:   'Participaste en raid',
  YOUTUBE_COMMENT:           'Comentario en YouTube',
  YOUTUBE_SUBSCRIBE:         'Sub en YouTube',
  YOUTUBE_SHARE:             'Compartiste video',
  TELEGRAM_MESSAGE:          'Mensaje en Telegram',
  TELEGRAM_JOIN:             'Te uniste al grupo',
  TELEGRAM_REACTION:         'Reaccion en Telegram',
  MISSION_COMPLETED:         'Quest completada',
  STREAK_BONUS:              'Mision diaria 🔥',
  BADGE_EARNED:              'Logro desbloqueado',
  ADMIN_MANUAL_GRANT:        'XP otorgado por admin',
}

export default function DashboardClient({
  initialProfile,
  initialEvents,
  initialMissions,
  userId,
  allBadges,
  earnedBadgeIds,
  myRank,
}: DashboardClientProps) {
  const earnedSet = new Set(earnedBadgeIds)

  const badgesByFamily: Record<string, BadgeItem[]> = {}
  for (const badge of allBadges) {
    if (!badgesByFamily[badge.family]) badgesByFamily[badge.family] = []
    badgesByFamily[badge.family].push(badge)
  }

  const [profile,     setProfile]    = useState(initialProfile)
  const [events,      setEvents]     = useState(initialEvents)
  const [missions,    setMissions]   = useState(initialMissions)
  const [toasts,      setToasts]     = useState<XpToastData[]>([])
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number } | null>(null)
  const [badgeUnlock, setBadgeUnlock] = useState<BadgeItem | null>(null)

  const lastXpRef           = useRef(initialProfile?.user_reputation?.total_xp ?? 0)
  const lastLevelRef        = useRef(initialProfile?.user_reputation?.level ?? 1)
  const lastEventRef        = useRef(initialEvents[0]?.id ?? '')
  const lastLevelUpShownRef = useRef(initialProfile?.user_reputation?.level ?? 1)

  const supabase = createClient()

  const addToast = useCallback((xp: number, eventType: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, xp, eventType }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    async function poll() {
      try {
        const { data: rep } = await (supabase
          .from('user_reputation')
          .select('*')
          .eq('user_id', userId)
          .single() as any) as { data: import('@/types/database').UserReputation | null }

        if (rep) {
          const newXp    = rep.total_xp
          const newLevel = rep.level

          if (newLevel > lastLevelRef.current && newLevel > lastLevelUpShownRef.current) {
            setLevelUpData({ oldLevel: lastLevelRef.current, newLevel })
            lastLevelUpShownRef.current = newLevel
            lastLevelRef.current = newLevel
          } else if (newLevel > lastLevelRef.current) {
            lastLevelRef.current = newLevel
          }

          if (newXp !== lastXpRef.current) {
            lastXpRef.current = newXp
            setProfile(prev => prev ? { ...prev, user_reputation: rep } : prev)
          }
        }

        const { data: newEvents } = await (supabase
          .from('xp_events')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5) as any) as { data: import('@/types/database').XpEvent[] | null }

        if (newEvents?.length) {
          const latestId = newEvents[0].id
          if (latestId !== lastEventRef.current) {
            const previousIdx = newEvents.findIndex(e => e.id === lastEventRef.current)
            const newOnes = previousIdx === -1 ? newEvents.slice(0, 1) : newEvents.slice(0, previousIdx)
            newOnes.reverse().forEach(event => addToast(event.xp_awarded, event.event_type))
            lastEventRef.current = latestId
            setEvents(newEvents)
          }
        }
      } catch { /* silenciar */ }
    }

    poll()
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [userId])

  useEffect(() => {
    const channel = supabase
      .channel(`levelups:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_level_ups' },
        (payload) => {
          const lu = payload.new as { user_id: string; level: number; xp_bonus: number }
          if (lu.user_id !== userId) return
          if (lu.level > lastLevelUpShownRef.current) {
            setLevelUpData({ oldLevel: lu.level - 1, newLevel: lu.level })
            lastLevelUpShownRef.current = lu.level
          }
          if (lu.xp_bonus > 0) addToast(lu.xp_bonus, 'ADMIN_MANUAL_GRANT')
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    const channel = supabase
      .channel(`badges:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'user_badges',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const badge = allBadges.find(b => b.id === (payload.new as any).badge_id)
        if (badge) setBadgeUnlock(badge)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, allBadges])

  // Badges visibles en el contador: no-secretos siempre + secretos solo si ganados
  const visibleTotal = allBadges.filter(b => !b.is_secret || earnedSet.has(b.id)).length

  return (
    <div className="space-y-6">

      <PlayerCard profile={profile as any} myRank={myRank} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity events={events} />
        <ActiveMissions missions={missions} />
      </div>

      {allBadges.length > 0 && (
        <div className="gradient-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-foreground">🏆 Logros</h2>
            <span className="text-xs text-muted-foreground">
              {earnedSet.size} / {visibleTotal} desbloqueados
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
                    {fBadges.map((badge, bi) => {
                      const isEarned = earnedSet.has(badge.id)
                      const isSecret = badge.is_secret && !isEarned

                      if (isSecret) {
                        return (
                          <div key={badge.id}
                            className="border border-border/40 rounded-xl p-3 flex items-center gap-3 bg-secondary/10 fade-in-up"
                            style={{ animationDelay: `${bi * 40}ms` }}
                          >
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              <Lock className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-muted-foreground/50">???</p>
                              <p className="text-xs text-muted-foreground/30">Logro secreto</p>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={badge.id}
                          className={`border rounded-xl p-3 flex items-center gap-3 transition-all duration-200 fade-in-up ${
                            isEarned
                              ? `${TIER_COLORS[badge.tier] ?? 'border-border bg-secondary/30'} badge-earned card-hover cursor-default`
                              : 'border-border bg-secondary/20 opacity-40 grayscale'
                          }`}
                          style={{ animationDelay: `${bi * 40}ms` }}
                        >
                          <span className="text-2xl">{badge.image_url || '🏅'}</span>
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
          <XpToast key={toast.id} xp={toast.xp} label={EVENT_LABELS[toast.eventType] ?? toast.eventType} />
        ))}
      </div>

      {levelUpData && (
        <LevelUpModal
          oldLevel={levelUpData.oldLevel}
          newLevel={levelUpData.newLevel}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {badgeUnlock && (
        <BadgeUnlockModal badge={badgeUnlock} onClose={() => setBadgeUnlock(null)} />
      )}

    </div>
  )
}
