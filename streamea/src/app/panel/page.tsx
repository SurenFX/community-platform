import { redirect } from 'next/navigation'
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'
import { CopyButton } from './copy-button'

export const dynamic = 'force-dynamic'

const BOT_NAME = 'streameabot'

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { connected, error } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: streamer } = await supabase
    .from('st_streamers')
    .select('display_name, kick_slug, twitch_login')
    .eq('user_id', user.id)
    .maybeSingle()

  const kickConnected   = Boolean(streamer?.kick_slug)
  const twitchConnected = Boolean(streamer?.twitch_login)

  return (
    <main>
      <h1 className="text-2xl font-bold">
        {streamer ? `Hola, ${streamer.display_name}` : 'Bienvenido a Streamea'}
      </h1>
      <p className="mt-2 text-zinc-400">
        {kickConnected || twitchConnected
          ? 'Tu canal está conectado. Ya podés usar las herramientas.'
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

      {/* Paso final del onboarding: el bot necesita ser moderador para escribir */}
      {kickConnected && (
        <section className="mt-6 rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div className="flex-1">
              <h2 className="font-semibold">Último paso: hacé moderador al bot</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Para que pueda responder en tu chat, escribí este comando en el chat de tu
                propio canal de Kick:
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200">
                  /mod {BOT_NAME}
                </code>
                <CopyButton text={`/mod ${BOT_NAME}`} />
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
