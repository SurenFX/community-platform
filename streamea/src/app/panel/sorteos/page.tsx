import { redirect } from 'next/navigation'
import { Ticket, Trophy, Users, X } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'
import { startRaffle, closeRaffle, drawWinner, deleteRaffle } from '../actions'

export const dynamic = 'force-dynamic'

export default async function SorteosPage() {
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
        <h1 className="text-2xl font-bold">Sorteos</h1>
        <p className="mt-3 rounded-xl border border-surface-border bg-surface-raised p-5 text-zinc-400">
          Primero conectá tu cuenta de Kick desde{' '}
          <a href="/panel" className="text-brand underline">Inicio</a>.
        </p>
      </main>
    )
  }

  const { data: raffles } = await supabase
    .from('st_raffles')
    .select('id, keyword, status, winner, created_at')
    .eq('streamer_id', streamer.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const list   = (raffles ?? []) as any[]
  const active = list.find(r => r.status === 'active')

  // Conteo de participantes del sorteo activo
  let entries: { username: string }[] = []
  if (active) {
    const { data } = await supabase
      .from('st_raffle_entries')
      .select('username')
      .eq('raffle_id', active.id)
      .order('entered_at', { ascending: false })
    entries = (data ?? []) as any[]
  }

  return (
    <main>
      <h1 className="text-2xl font-bold">Sorteos</h1>
      <p className="mt-2 text-zinc-400">
        Elegí una palabra clave. Quien la escriba en tu chat de Kick participa.
      </p>

      {!active ? (
        <form
          action={startRaffle}
          className="mt-6 flex gap-2 rounded-2xl border border-surface-border bg-surface-raised p-5"
        >
          <input
            name="keyword"
            required
            maxLength={40}
            placeholder="Palabra clave (ej: !sorteo)"
            className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-brand"
          />
          <button className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-hover">
            <Ticket className="h-4 w-4" /> Abrir sorteo
          </button>
        </form>
      ) : (
        <section className="mt-6 rounded-2xl border border-brand/40 bg-brand/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">Sorteo abierto — palabra clave</p>
              <p className="text-2xl font-bold text-brand">{active.keyword}</p>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Users className="h-5 w-5" />
              <span className="text-2xl font-bold">{entries.length}</span>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <form action={drawWinner}>
              <input type="hidden" name="raffleId" value={active.id} />
              <button
                disabled={entries.length === 0}
                className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-hover disabled:opacity-40"
              >
                <Trophy className="h-4 w-4" /> Sortear ganador
              </button>
            </form>
            <form action={closeRaffle}>
              <input type="hidden" name="raffleId" value={active.id} />
              <button className="flex items-center gap-2 rounded-xl border border-surface-border px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-red-500/50 hover:text-red-400">
                <X className="h-4 w-4" /> Cerrar sin sortear
              </button>
            </form>
          </div>

          {entries.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm text-zinc-400">Participantes</p>
              <div className="flex flex-wrap gap-2">
                {entries.slice(0, 60).map(e => (
                  <span
                    key={e.username}
                    className="rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {e.username}
                  </span>
                ))}
                {entries.length > 60 && (
                  <span className="px-2 py-1 text-xs text-zinc-500">
                    +{entries.length - 60} más
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-zinc-500">
            La lista se actualiza al recargar la página.
          </p>
        </section>
      )}

      {/* Historial */}
      {list.filter(r => r.status !== 'active').length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold text-zinc-300">Anteriores</h2>
          <div className="space-y-2">
            {list.filter(r => r.status !== 'active').map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-raised px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{r.keyword}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString('es-AR')}
                    {r.winner ? ` · ganó ${r.winner}` : ' · sin ganador'}
                  </p>
                </div>
                <form action={deleteRaffle}>
                  <input type="hidden" name="raffleId" value={r.id} />
                  <button className="text-xs text-zinc-500 transition hover:text-red-400">
                    Borrar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
