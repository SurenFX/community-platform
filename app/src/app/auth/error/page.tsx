import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="inline-flex p-3 rounded-2xl bg-destructive/10 mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Error de autenticación</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Hubo un problema al iniciar sesión. Por favor intentá de nuevo.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full py-3 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-all"
        >
          Volver al login
        </Link>
      </div>
    </div>
  )
}
