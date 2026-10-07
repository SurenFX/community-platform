import { redirect } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'
import { saveCommand, deleteCommand, toggleCommand } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ComandosPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: streamer } = await supabase
    .from('st_streamers')
    .select('id, kick_slug, twitch_login')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!streamer?.kick_slug && !streamer?.twitch_login) {
    return (
      <main>
        <h1 className="text-2xl font-bold">Comandos</h1>
        <p className="mt-3 rounded-xl border border-surface-border bg-surface-raised p-5 text-zinc-400">
          Primero conectá tu cuenta de Kick o Twitch desde{' '}
          <a href="/panel" className="text-brand underline">Inicio</a>.
        </p>
      </main>
    )
  }

  const { data: commands, error: loadError } = await supabase
    .from('st_commands')
    .select('id, command, response, cooldown_seconds, is_active')
    .eq('streamer_id', streamer.id)
    .order('command')

  const list = (commands ?? []) as { id: string; command: string; response: string; cooldown_seconds: number; is_active: boolean }[]

  return (
    <main>
      <h1 className="text-2xl font-bold">Comandos</h1>
      <p className="mt-2 text-zinc-400">
        Respuestas automáticas para tu chat. También podés crearlos desde el chat con{' '}
        <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-zinc-300">
          !addcom !comando respuesta
        </code>
      </p>

      {result && <p role="status" className="mt-4 rounded-xl border border-surface-border p-4 text-sm">{({ saved: "Comando guardado. Editar conserva el estado activo o en pausa.", updated: "Estado actualizado.", deleted: "Comando eliminado.", invalid: "Revisá el comando (hasta 30 caracteres, sin espacios), la respuesta (hasta 480) y el intervalo (5–3600 segundos). !addcom y !delcom están reservados.", failed: "No pudimos guardar el cambio. Intentá de nuevo." } as Record<string,string>)[result]}</p>}
      {loadError && <p role="alert" className="mt-4 text-red-400">No pudimos cargar los comandos. Intentá de nuevo más tarde.</p>}
      <form
        action={saveCommand}
        className="mt-6 space-y-3 rounded-2xl border border-surface-border bg-surface-raised p-5"
      >
        <div className="flex gap-2">
          <input
            name="command"
            required
            maxLength={30}
            placeholder="!redes"
            className="w-40 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-brand"
          />
          <input
            name="response"
            required
            maxLength={480}
            placeholder="Respuesta que manda el bot"
            className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-brand"
          />
        </div>
        <label className="block text-sm">Intervalo entre respuestas (segundos)<input name="cooldown_seconds" type="number" min={5} max={3600} required defaultValue={30} className="ml-3 rounded-xl border border-surface-border bg-surface px-3 py-2" /></label>
        <button className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-hover">
          <Plus className="h-4 w-4" /> Guardar comando
        </button>
      </form>

      <section className="mt-6 space-y-2">
        {!loadError && list.length === 0 && (
          <p className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-zinc-500">
            Todavía no tenés comandos.
          </p>
        )}
        {list.map(c => (
          <div
            key={c.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-surface-border bg-surface-raised px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-brand">{c.command}</p>
              <p className="mt-0.5 break-words text-sm text-zinc-400">{c.response}</p>
            </div>
            <div className="space-y-3"><p className="text-xs text-zinc-400">{c.is_active ? "Activo" : "En pausa"} · {c.cooldown_seconds}s</p>
            <form action={toggleCommand}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="enable" value={String(!c.is_active)} /><button className="text-sm text-brand">{c.is_active ? "Pausar" : "Activar"}</button></form>
            <details><summary className="cursor-pointer text-sm text-brand">Editar</summary><form action={saveCommand} className="mt-3 space-y-3"><input type="hidden" name="command" value={c.command} /><label className="block text-sm">Respuesta<textarea name="response" required maxLength={480} defaultValue={c.response} className="mt-2 w-full rounded-lg bg-surface p-3" /></label><label className="block text-sm">Intervalo (segundos)<input name="cooldown_seconds" type="number" min={5} max={3600} required defaultValue={c.cooldown_seconds} className="ml-2 rounded-lg bg-surface p-2" /></label><button className="text-sm text-brand">Guardar cambios</button></form></details>
            <form action={deleteCommand}>
              <input type="hidden" name="id" value={c.id} />
              <button className="shrink-0 text-zinc-500 transition hover:text-red-400">
                <Trash2 aria-label="Eliminar comando" className="h-4 w-4" />
              </button>
            </form></div>
          </div>
        ))}
      </section>
    </main>
  )
}
