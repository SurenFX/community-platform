import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { saveAnnouncement, toggleAnnouncement } from './actions'

export const dynamic = 'force-dynamic'
const fieldClass = 'w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand'
const buttonClass = 'rounded-xl border border-brand/40 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10'
type Notice = { platform: 'KICK' | 'TWITCH'; id: string; message: string; interval_minutes: number; min_messages: number; is_active: boolean; last_sent_at: string | null }

function Fields({ notice, channels }: { notice?: Notice; channels: { value: string; label: string }[] }) {
  return <><label className="block text-sm">Destino<select name="platform" required defaultValue={notice?.platform ?? channels[0]?.value} className={`${fieldClass} mt-2`}>{channels.map(channel => <option key={channel.value} value={channel.value}>{channel.label}</option>)}</select></label>
    <label className="block text-sm">Texto del aviso
      <textarea name="message" required maxLength={400} rows={3} defaultValue={notice?.message}
        placeholder="Seguime en mis redes: …" className={`${fieldClass} mt-2`} />
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Intervalo mínimo (minutos)
        <input name="interval_minutes" type="number" min={5} max={1440} required defaultValue={notice?.interval_minutes ?? 15} className={`${fieldClass} mt-2`} />
      </label>
      <label className="block text-sm">Mensajes del chat entre avisos
        <input name="min_messages" type="number" min={5} max={100} required defaultValue={notice?.min_messages ?? 5} className={`${fieldClass} mt-2`} />
      </label>
    </div>
  </>
}

export default async function Avisos({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: streamer } = await supabase.from('st_streamers').select('id,kick_slug,twitch_login').eq('user_id', user.id).maybeSingle()
  if (!streamer?.kick_slug && !streamer?.twitch_login) return <main><h1 className="text-2xl font-bold">Avisos</h1>
    <p className="mt-3 text-zinc-400">Conectá tu canal de Kick o Twitch desde <a href="/panel" className="text-brand underline">Inicio</a> para configurar avisos.</p></main>
  const channels = [{ value: 'KICK', label: 'Kick', connected: Boolean(streamer.kick_slug) }, { value: 'TWITCH', label: 'Twitch', connected: Boolean(streamer.twitch_login) }].filter(channel => channel.connected)
  const { data, error } = await supabase.from('st_announcements')
    .select('id,platform,message,interval_minutes,min_messages,is_active,last_sent_at').eq('streamer_id', streamer.id).order('created_at')
  const notices = (data ?? []) as Notice[]
  const messages: Record<string, string> = {
    connect: 'Conectá el canal elegido desde Inicio antes de guardar o activar avisos.',
    saved: 'Aviso guardado en pausa. Podés activarlo cuando estés listo.',
    enabled: 'Aviso activado. El primer envío espera el intervalo y la actividad configurados.',
    paused: 'Aviso pausado.', invalid: 'Revisá el texto, el intervalo (5–1440 minutos) y la cantidad de mensajes (5–100).',
    error: 'No pudimos guardar el cambio. Intentá de nuevo.', limit: 'Podés guardar hasta 10 avisos.',
  }
  return <main>
    <h1 className="text-2xl font-bold">Avisos</h1>
    <p className="mt-2 text-zinc-400">Recordatorios para tus chats de Kick y Twitch: redes, próximos directos o información de tu canal.</p>
    <p className="mt-3 text-sm text-zinc-400">Se envían con el siguiente mensaje del chat cuando se cumplen el intervalo y la actividad mínima. Si el chat está quieto, no se envían. Entre avisos hay al menos un minuto. Guardar o editar deja el aviso en pausa.</p>
    {result && messages[result] && <p role="status" className="mt-4 rounded-xl border border-surface-border p-4 text-sm">{messages[result]}</p>}
    {error ? <p role="alert" className="mt-6 rounded-xl border border-red-500/30 p-4 text-red-400">No pudimos cargar tus avisos. Intentá de nuevo más tarde.</p> : <>
      <form action={saveAnnouncement} className="mt-6 space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h2 className="font-semibold">Nuevo aviso</h2><Fields channels={channels} />
        <button className={buttonClass}>Guardar en pausa</button>
      </form>
      <section className="mt-6 space-y-4" aria-label="Avisos guardados">
        {!notices.length && <p className="rounded-xl border border-dashed border-surface-border p-6 text-sm text-zinc-400">Todavía no tenés avisos. Creá uno arriba; empezará en pausa.</p>}
        {notices.map(notice => <article key={notice.id} className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{notice.platform === 'KICK' ? 'Kick' : 'Twitch'} · {notice.is_active ? 'Activo' : 'En pausa'}</h2>
            <form action={toggleAnnouncement}><input type="hidden" name="id" value={notice.id} /><input type="hidden" name="enable" value={String(!notice.is_active)} />
              <button className={buttonClass}>{notice.is_active ? 'Pausar' : 'Activar'}</button></form>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-zinc-300">{notice.message}</p>
          <p className="mt-2 text-sm text-zinc-400">Cada {notice.interval_minutes} minutos como mínimo y después de {notice.min_messages} mensajes.</p>
          <p className="mt-2 text-xs text-zinc-500">{notice.last_sent_at ? `Último envío: ${new Intl.DateTimeFormat('es-UY', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Montevideo' }).format(new Date(notice.last_sent_at))} (Uruguay).` : 'Sin envíos confirmados.'}</p>
          <details className="mt-4"><summary className="cursor-pointer text-sm text-brand">Editar aviso</summary>
            <form action={saveAnnouncement} className="mt-4 space-y-4"><input type="hidden" name="id" value={notice.id} /><Fields notice={notice} channels={channels} />
              <button className={buttonClass}>Guardar cambios y pausar</button></form></details>
        </article>)}
      </section>
    </>}
  </main>
}
