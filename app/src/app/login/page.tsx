'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Sword, Trophy, Shield, Zap, AlertCircle, Loader2 } from 'lucide-react'

function LoginContent() {
  const searchParams = useSearchParams()
  const errorMessage = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  async function handleDiscordLogin() {
    try {
      setLoading(true)
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          scopes: 'identify email guilds guilds.members.read',
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      })
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-5 level-glow">
            <Sword className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Community Platform
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Tu hub de reputación y engagement gaming
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Trophy, label: 'Rankings',   color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { icon: Shield, label: 'Reputación', color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
            { icon: Zap,    label: 'Misiones',   color: 'text-purple-400', bg: 'bg-purple-400/10' },
          ].map(({ icon: Icon, label, color, bg }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <h2 className="text-lg font-bold text-foreground mb-1">
            Entrar a la comunidad
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Conectá tu Discord para empezar a ganar XP, subir de nivel
            y participar en los rankings.
          </p>

          {errorMessage && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {decodeURIComponent(errorMessage)}
            </div>
          )}

          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            )}
            {loading ? 'Conectando...' : 'Continuar con Discord'}
          </button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Al continuar aceptás los términos de uso y política de privacidad
          </p>
        </div>

        <div className="mt-4 bg-card/50 border border-border/50 rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Permisos que solicitamos:
          </p>
          <ul className="space-y-1">
            {[
              'Tu nombre de usuario y avatar',
              'Tu dirección de email',
              'Lista de servidores en los que estás',
            ].map((perm) => (
              <li key={perm} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-green-400">✓</span>
                {perm}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
