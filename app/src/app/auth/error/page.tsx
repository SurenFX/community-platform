import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center"
        style={{ boxShadow: '0 0 40px hsl(185 100% 45% / 0.06)' }}>

        <div className="text-4xl mb-4">🌭</div>
        <p className="font-extrabold text-foreground tracking-tight mb-6">SalchiNeta</p>

        <div className="inline-flex p-3 rounded-2xl bg-destructive/10 mb-4">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-lg font-bold text-foreground mb-2">Error de autenticación</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Hubo un problema al iniciar sesión. Por favor intentá de nuevo.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full py-3 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold text-sm transition-all hover:scale-[1.02]"
        >
          Volver al login
        </Link>
        <Link href="/" className="block text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors">
          ← Ir al inicio
        </Link>
      </div>
    </div>
  )
}
