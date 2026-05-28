'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface DashboardClientProps {
  initialProfile:  ProfileWithAll | null
  initialEvents:   XpEvent[]
  initialMissions: MissionWithData[]
  userId:          string
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
}: DashboardClientProps) {
  const [profile,     setProfile]     = useState(initialProfile)
  const [events,      setEvents]      = useState(initialEvents)
  const [missions,    setMissions]    = useState(initialMissions)
  const [toasts,      setToasts]      = useState<XpToastData[]>([])
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number } | null>(null)

  const supabase = createClient()

  const addToast = useCallback((xp: number, eventType: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, xp, eventType }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    // Suscripción SIN filtro — filtramos en el cliente
    // El filtro server-side no funciona con service_role en plan free
    const channel = supabase
      .channel(`dashboard:${userId}`)

      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'user_reputation',
        },
        (payload) => {
          const newRep = payload.new as UserReputation
          // Filtrar en el cliente
          if (newRep.user_id !== userId) return
          setProfile(prev => prev ? { ...prev, user_reputation: newRep } : prev)
        }
      )

      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'xp_events',
        },
        (payload) => {
          const newEvent = payload.new as XpEvent
          if (newEvent.user_id !== userId) return
          setEvents(prev => [newEvent, ...prev].slice(0, 10))
          addToast(newEvent.xp_awarded, newEvent.event_type)
        }
      )

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
          setLevelUpData({
            oldLevel: levelUp.level - 1,
            newLevel: levelUp.level,
          })
          if (levelUp.xp_bonus > 0) {
            addToast(levelUp.xp_bonus, 'ADMIN_MANUAL_GRANT')
          }
        }
      )

      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'user_missions',
        },
        async (payload) => {
          const updated = payload.new as UserMission
          if (updated.user_id !== userId) return
          if (updated.is_completed) {
            const { data } = await supabase
              .from('user_missions')
              .select('*, missions(*)')
              .eq('user_id', userId)
              .eq('is_completed', false)
              .limit(3)
            if (data) setMissions(data as MissionWithData[])
          } else {
            setMissions(prev =>
              prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
            )
          }
        }
      )

      .subscribe((status) => {
        console.log('[Realtime] status:', status)
      })

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
