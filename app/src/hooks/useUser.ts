'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserReputation } from '@/types/database'

interface UserWithReputation extends Profile {
  user_reputation: UserReputation | null
}

interface UseUserReturn {
  user: UserWithReputation | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserWithReputation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function fetchUser() {
    try {
      setLoading(true)
      setError(null)

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUser(null)
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*, user_reputation(*)')
        .eq('id', authUser.id)
        .single()

      if (profileError) throw profileError
      setUser(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()

    // Escuchar cambios de sesión (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') fetchUser()
        if (event === 'SIGNED_OUT') setUser(null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, error, refresh: fetchUser }
}
