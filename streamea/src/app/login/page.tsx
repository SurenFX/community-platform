'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Mail, Lock } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase/client'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowser()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setLoading(false)
        setError(
          error.message.includes('already registered')
            ? 'Ese email ya tiene cuenta. Probá entrar.'
            : error.message.includes('at least')
              ? 'La contraseña necesita al menos 6 caracteres.'
              : 'No pudimos crear la cuenta. Probá de nuevo.'
        )
        return
      }
      // Si el proyecto no exige confirmar el mail, signUp ya deja sesión activa.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setLoading(false)
          setError('Cuenta creada. Revisá tu correo para confirmarla y despues entrá.')
          return
        }
      }
      router.push('/panel')
      router.refresh()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'Email o contraseña incorrectos.'
          : 'No pudimos entrar. Probá de nuevo.'
      )
      return
    }
    router.push('/panel')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <a href="/" className="mb-8 flex items-center gap-2">
        <Gift className="h-8 w-8 text-brand" />
        <span className="text-2xl font-bold">Streamea</span>
      </a>

      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-8">
        {/* Tabs */}
        <div className="mb-6 flex rounded-xl border border-surface-border p-1">
          {(['login', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m ? 'bg-brand text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-surface-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-xl border border-surface-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
          >
            {loading
              ? 'Un momento…'
              : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500">
          {mode === 'login'
            ? '¿No tenés cuenta? Tocá "Crear cuenta" arriba.'
            : 'Con crear la cuenta ya entrás — no hace falta confirmar nada.'}
        </p>
      </div>
    </main>
  )
}
