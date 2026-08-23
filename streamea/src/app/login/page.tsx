'use client'

import { useState } from 'react'
import { Gift, Mail, CheckCircle } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    setLoading(false)
    if (error) setError('No pudimos enviar el mail. Probá de nuevo en un rato.')
    else setSent(true)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <a href="/" className="mb-8 flex items-center gap-2">
        <Gift className="h-8 w-8 text-brand" />
        <span className="text-2xl font-bold">Streamea</span>
      </a>

      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-8">
        {sent ? (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-brand-kick" />
            <h1 className="text-lg font-semibold">Revisá tu correo</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Te mandamos un link a <span className="text-zinc-200">{email}</span>.
              Hacé clic y entrás directo — sin contraseña.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Entrar a Streamea</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Te mandamos un link mágico por email. Sin contraseñas.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-xl border border-surface-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
              >
                {loading ? 'Enviando…' : 'Mandame el link'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
