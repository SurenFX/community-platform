import { redirect } from 'next/navigation'
import { Gift, CheckCircle2, Circle, LogOut } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function signOut() {
  'use server'
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { connected, error } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS: el streamer solo ve su propia fila
  const { data: streamer } = await supabase
    .from('st_streamers')
    .select('display_name, kick_slug, twitch_login')
    .eq('user_id', user.id)
    .maybeSingle()

  const kickConnected   = Boolean(streamer?.kick_slug)
  const twitchConnected = Boolean(streamer?.twitch_login)

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="h-7 w-7 text-brand" />
          <span className="text-xl font-bold">Streamea</span>
        </div>
        <form action={signOut}>
          <button className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </form>
      </header>

      <h1 className="text-2xl font-bold">
        {streamer ? `Hola, ${streamer.display_name}` : 'Bienvenido a Streamea'}
      </h1>
      <p className="mt-2 text-zinc-400">
        {kickConnected || twitchConnected
          ? 'Tu canal está conectado. Los sorteos llegan muy pronto.'
          : 'Conectá tu canal para empezar. Un clic, sin configurar nada.'}
      </p>

      {connected && (
        <p className="mt-4 rounded-xl border border-brand-kick/30 bg-brand-kick/10 px-4 py-3 text-sm text-brand-kick">
          {connected === 'kick' ? 'Kick conectado correctamente.' : 'Twitch conectado correctamente.'}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Hubo un problema conectando la cuenta ({error}). Probá de nuevo.
        </p>
      )}

      <section className="mt-8 space-y-4">
        {/* Kick */}
        <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-raised p-5">
          <div className="flex items-center gap-3">
            {kickConnected
              ? <CheckCircle2 className="h-6 w-6 text-brand-kick" />
              : <Circle className="h-6 w-6 text-zinc-600" />}
            <div>
              <p className="font-semibold text-brand-kick">Kick</p>
              <p className="text-sm text-zinc-400">
                {kickConnected ? `kick.com/${streamer!.kick_slug}` : 'No conectado'}
              </p>
            </div>
          </div>
          <a
            href="/auth/kick/start"
            className="rounded-xl border border-brand-kick/40 px-4 py-2 text-sm font-semibold text-brand-kick transition hover:bg-brand-kick/10"
          >
            {kickConnected ? 'Reconectar' : 'Conectar'}
          </a>
        </div>

        {/* Twitch */}
        <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-raised p-5">
          <div className="flex items-center gap-3">
            {twitchConnected
              ? <CheckCircle2 className="h-6 w-6 text-brand-twitch" />
              : <Circle className="h-6 w-6 text-zinc-600" />}
            <div>
              <p className="font-semibold text-brand-twitch">Twitch</p>
              <p className="text-sm text-zinc-400">
                {twitchConnected ? `twitch.tv/${streamer!.twitch_login}` : 'No conectado'}
              </p>
            </div>
          </div>
          <a
            href="/auth/twitch/start"
            className="rounded-xl border border-brand-twitch/40 px-4 py-2 text-sm font-semibold text-brand-twitch transition hover:bg-brand-twitch/10"
          >
            {twitchConnected ? 'Reconectar' : 'Conectar'}
          </a>
        </div>
      </section>

      {/* Placeholder etapa 3 */}
      <section className="mt-10 rounded-2xl border border-dashed border-surface-border p-8 text-center">
        <Gift className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
        <h2 className="font-semibold text-zinc-300">Sorteos</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Acá vas a lanzar sorteos por palabra clave en tu chat. En construcción.
        </p>
      </section>
    </main>
  )
}
