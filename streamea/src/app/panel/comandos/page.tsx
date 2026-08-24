import { redirect } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'
import { saveCommand, deleteCommand } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ComandosPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: streamer } = await supabase
    .from('st_streamers')
    .select('id, kick_slug')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!streamer?.kick_slug) {
    return (
      <main>
        <h1 className="text-2xl font-bold">Comandos</h1>
        <p className="mt-3 rounded-xl border border-surface-border bg-surface-raised p-5 text-zinc-400">
          Primero conectá tu cuenta de Kick desde{' '}
          <a href="/panel" className="text-brand underline">Inicio</a>.
        </p>
      </main>
    )
  }

  const { data: commands } = await supabase
    .from('st_commands')
    .select('id, command, response')
    .eq('streamer_id', streamer.id)
    .order('command')

  const list = (commands ?? []) as any[]

  return (
    <main>
      <h1 className="text-2xl font-bold">Comandos</h1>
      <p className="mt-2 text-zinc-400">
        Respuestas automáticas para tu chat. También podés crearlos desde el chat con{' '}
        <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-zinc-300">
          !addcom !comando respuesta
        </code>
      </p>

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
        <button className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-hover">
          <Plus className="h-4 w-4" /> Guardar comando
        </button>
      </form>

      <section className="mt-6 space-y-2">
        {list.length === 0 && (
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
            <form action={deleteCommand}>
              <input type="hidden" name="id" value={c.id} />
              <button className="shrink-0 text-zinc-500 transition hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          </div>
        ))}
      </section>
    </main>
  )
}
