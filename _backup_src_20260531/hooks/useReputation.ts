'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserReputation } from '@/types/database'

// Hook que mantiene la reputación del usuario en tiempo real
// usando Supabase Realtime (WebSockets sobre Postgres changes)
export function useReputation(userId: string | undefined) {
  const [reputation, setReputation] = useState<UserReputation | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    // Carga inicial
    supabase
      .from('user_reputation')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setReputation(data)
        setLoading(false)
      })

    // Suscripción en tiempo real — cada vez que el worker actualiza XP,
    // el frontend se actualiza automáticamente sin polling
    const channel = supabase
      .channel(`reputation:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'user_reputation',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setReputation(payload.new as UserReputation)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { reputation, loading }
}
