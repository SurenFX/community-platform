'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-5">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Hubo un error cargando esta página. Podés intentar de nuevo o volver al inicio.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
