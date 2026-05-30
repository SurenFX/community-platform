'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

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
          scopes:     'identify email guilds guilds.members.read',
          redirectTo: `${window.location.origin}/auth/callback`,
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

        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5"
            style={{ background: 'linear-gradient(135deg, #00D4E8, #FFD700)', padding: '2px' }}>
            <div className="w-full h-full rounded-3xl bg-background flex items-center justify-center">
              <span className="text-3xl">🌭</span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight"
            style={{ background: 'linear-gradient(90deg, #00D4E8, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SalchiNeta
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Community Platform — Ganá XP, subí de nivel, dominá el ranking
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { emoji: '⚡', label: 'XP & Niveles',  color: 'from-cyan-400/20 to-cyan-400/5',   border: 'border-cyan-400/30'   },
            { emoji: '🏆', label: 'Rankings',       color: 'from-yellow-400/20 to-yellow-400/5',border: 'border-yellow-400/30' },
            { emoji: '🎯', label: 'Misiones',       color: 'from-red-400/20 to-red-400/5',     border: 'border-red-400/30'    },
          ].map(({ emoji, label, color, border }) => (
            <div key={label} className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-b ${color} border ${border}`}>
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8"
          style={{ boxShadow: '0 0 40px hsl(185 100% 45% / 0.08)' }}>
          <h2 className="text-lg font-bold text-foreground mb-1">
            Entrar a la comunidad
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Conectá tu Discord y empezá a ganar XP por tu actividad en Discord, Twitch y YouTube.
          </p>

          {errorMessage && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {decodeURIComponent(errorMessage)}
            </div>
          )}

          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 font-bold py-3.5 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #5865F2, #4752c4)', color: 'white' }}
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
