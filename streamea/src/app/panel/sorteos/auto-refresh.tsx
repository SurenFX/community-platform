'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Refresca los datos del server component cada N segundos (sorteo en vivo). */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])

  return null
}
