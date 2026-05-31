'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseReputationRealtimeProps {
  userId: string
  onUpdate: (data: Record<string, unknown>) => void
}

/**
 * Escucha cambios en user_reputation en tiempo real.
 * Cuando el worker acredita XP, Supabase Realtime pushea el cambio
 * y el frontend actualiza sin hacer polling.
 */
export function useReputationRealtime({ userId, onUpdate }: UseReputationRealtimeProps) {
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`reputation:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_reputation',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onUpdate(payload.new as Record<string, unknown>)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}

interface UseMissionsRealtimeProps {
  userId: string
  onUpdate: (data: Record<string, unknown>) => void
}

/**
 * Escucha cambios en user_missions en tiempo real.
 * Cuando el worker completa una misión, el frontend se actualiza solo.
 */
export function useMissionsRealtime({ userId, onUpdate }: UseMissionsRealtimeProps) {
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`missions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_missions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onUpdate(payload.new as Record<string, unknown>)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}

/**
 * Escucha el leaderboard global — cualquier cambio en user_reputation
 * de cualquier usuario actualiza el ranking en tiempo real.
 */
export function useLeaderboardRealtime(onUpdate: () => void) {
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard:global')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_reputation',
        },
        () => {
          onUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
