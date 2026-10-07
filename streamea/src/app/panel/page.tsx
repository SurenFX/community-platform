import { redirect } from 'next/navigation'
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

import { activateBot, makeBotModerator } from './actions'

export const dynamic = 'force-dynamic'

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; bot?: string }>
}) {
  const { connected, error, bot } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: streamer } = await supabase
    .from('st_streamers')
    .select('display_name, kick_slug, twitch_login, kick_last_chat_at, twitch_last_chat_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const kickConnected   = Boolean(streamer?.kick_slug)
  const twitchConnected = Boolean(streamer?.twitch_login)
  const { data: twitchBot } = await createSupabaseAdmin().from('st_bot_tokens')
    .select('bot_username,bot_user_id').eq('platform', 'TWITCH').maybeSingle()
  const twitchBotReady = Boolean(twitchBot?.bot_user_id && twitchBot?.bot_username)

  return (
    <main>
      <h1 className="text-2xl font-bold">
        {streamer ? `Hola, ${streamer.display_name}` : 'Bienvenido a Streamea'}
      </h1>
      <p className="mt-2 text-zinc-400">
        {kickConnected || twitchConnected
          ? 'Tu cuenta está conectada. Comprobá abajo que el bot reciba mensajes de tu chat.'
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

      {bot && (
        <p role="status" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          bot === 'subscribed' ? 'border-brand/30 bg-brand/5 text-zinc-200' : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {bot === 'subscribed'
            ? 'La lectura del chat está configurada. Escribí un mensaje en tu canal y actualizá esta página para confirmar que llega.'
            : 'No pudimos activar el bot en todos los canales. Revisá los permisos de moderador o reconectá tu cuenta y probá otra vez.'}
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

      {(kickConnected || twitchConnected) && (
        <section className="mt-6 rounded-2xl border border-surface-border bg-surface-raised p-5">
          <h2 className="font-semibold">Actividad del bot</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Conectar una cuenta no confirma que el bot esté funcionando. Aquí se muestra el último mensaje recibido de cada chat.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { name: 'Kick', connected: kickConnected, lastChat: streamer?.kick_last_chat_at },
              { name: 'Twitch', connected: twitchConnected, lastChat: streamer?.twitch_last_chat_at },
            ].filter(channel => channel.connected).map(channel => (
              <p key={channel.name}>
                <span className="font-semibold">{channel.name}: </span>
                {channel.lastChat
                  ? <>último mensaje recibido <time dateTime={channel.lastChat}>{new Intl.DateTimeFormat('es-UY', {
                      dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
                    }).format(new Date(channel.lastChat))}</time> (UTC).</>
                  : 'Sin actividad confirmada. Escribí un mensaje en tu chat y actualizá esta página.'}
              </p>
            ))}
          </div>
          <form action={activateBot} className="mt-4">
            <button className="rounded-xl border border-brand/40 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10">
              Activar o reintentar conexión del bot
            </button>
          </form>
        </section>
      )}

      {kickConnected && (
        <p className="mt-6 text-sm text-zinc-400">
          El bot oficial de Kick responde usando la autorización de tu canal. Si no responde, reconectá tu cuenta y reintentá la conexión del bot.
        </p>
      )}
      {/* Twitch requiere moderación; Kick usa el bot oficial de la aplicación. */}
      {twitchConnected && !twitchBotReady && <p role="status" className="mt-6 rounded-xl border border-surface-border p-4 text-sm text-zinc-400">
        Tu canal de Twitch está conectado. La cuenta bot de Streamea todavía debe configurarse para poder responder. Los comandos, sorteos y avisos necesitan ese paso.
      </p>}
      {twitchConnected && twitchBotReady && (
        <section className="mt-6 rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div className="flex-1">
              <h2 className="font-semibold">Último paso: hacé moderador al bot</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Para que pueda responder en Twitch, hacé moderador al bot en tu canal:
              </p>



              {twitchConnected && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-twitch">
                    Twitch
                  </p>
                  <form action={makeBotModerator} className="flex items-center gap-2">
                    <button className="rounded-xl bg-brand-twitch px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                      Hacerlo moderador automáticamente
                    </button>
                    <span className="text-xs text-zinc-500">
                      o escribí <code className="text-zinc-400">/mod {twitchBot!.bot_username}</code> en tu chat
                    </span>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
