import { redirect } from 'next/navigation'
import { Ticket, Trophy, Users, X } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'
import { startRaffle, closeRaffle, drawWinner, deleteRaffle } from '../actions'
import { AutoRefresh } from './auto-refresh'

export const dynamic = 'force-dynamic'

export default async function SorteosPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
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
        <h1 className="text-2xl font-bold">Sorteos</h1>
        <p className="mt-3 rounded-xl border border-surface-border bg-surface-raised p-5 text-zinc-400">
          Primero conectá tu cuenta de Kick o Twitch desde{' '}
          <a href="/panel" className="text-brand underline">Inicio</a>.
        </p>
      </main>
    )
  }

  const { data: raffles, error: loadError } = await supabase
    .from('st_raffles')
    .select('id, keyword, status, winner, platform, created_at')
    .eq('streamer_id', streamer.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const list   = (raffles ?? []) as { id: string; keyword: string; status: string; winner: string | null; platform: string; created_at: string }[]
  const active = list.find(r => r.status === 'active')

  // Conteo de participantes del sorteo activo
  let entries: { username: string }[] = []
  let totalEntries = 0
  let entriesError = false
  if (active) {
    const { data, count, error } = await supabase
      .from('st_raffle_entries')
      .select('username', { count: 'exact' })
      .eq('raffle_id', active.id)
      .order('entered_at', { ascending: false })
      .limit(60)
    entries = (data ?? []) as { username: string }[]
    totalEntries = count ?? 0
    entriesError = Boolean(error)
  }

  return (
    <main>
      <h1 className="text-2xl font-bold">Sorteos</h1>
      <p className="mt-2 text-zinc-400">
        Elegí una palabra clave sin espacios. Quien la escriba en el chat de la plataforma elegida participa una sola vez.
      </p>

      {result && <p role="status" className="mt-4 rounded-xl border border-surface-border p-4 text-sm">{({
        opened: 'Sorteo abierto y anunciado en el chat.',
        opened_quiet: 'Sorteo abierto. No pudimos anunciarlo en el chat; los participantes pueden entrar con la palabra clave.',
        closed: 'Sorteo cerrado sin elegir ganador.',
        drawn: 'Ganador guardado y anunciado en el chat.',
        drawn_quiet: 'Ganador guardado. No pudimos anunciarlo en el chat; podés verlo en el historial.',
        unavailable: 'El sorteo ya no está abierto, no tiene participantes o no está disponible.',
        invalid: 'Usá una palabra clave de hasta 40 caracteres, sin espacios, y una plataforma conectada.',
        failed: 'No pudimos completar la operación. Revisá la conexión e intentá de nuevo.',
      } as Record<string, string>)[result] ?? 'Revisá el estado del sorteo abajo.'}</p>}
      {loadError && <p role="alert" className="mt-4 text-red-400">No pudimos cargar los sorteos. Intentá de nuevo más tarde.</p>}

      {!loadError && (!active ? (
        <form
          action={startRaffle}
          className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-surface-border bg-surface-raised p-5"
        >
          {streamer.kick_slug && streamer.twitch_login ? (
            <select
              name="platform"
              defaultValue="KICK"
              className="rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand"
            >
              <option value="KICK">Kick</option>
              <option value="TWITCH">Twitch</option>
            </select>
          ) : (
            <input
              type="hidden"
              name="platform"
              value={streamer.kick_slug ? 'KICK' : 'TWITCH'}
            />
          )}
          <input
            name="keyword"
            required
            maxLength={40}
            placeholder="Palabra clave (ej: !sorteo)"
            className="min-w-40 flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-brand"
          />
          <button className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-hover">
            <Ticket className="h-4 w-4" /> Abrir sorteo
          </button>
        </form>
      ) : (
        <section className="mt-6 rounded-2xl border border-brand/40 bg-brand/5 p-5">
          <AutoRefresh seconds={5} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">
                Sorteo abierto en{' '}
                <span className={active.platform === 'TWITCH' ? 'text-brand-twitch' : 'text-brand-kick'}>
                  {active.platform === 'TWITCH' ? 'Twitch' : 'Kick'}
                </span>{' '}
                — palabra clave
              </p>
              <p className="text-2xl font-bold text-brand">{active.keyword}</p>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Users className="h-5 w-5" />
              <span className="text-2xl font-bold">{entriesError ? '—' : totalEntries}</span>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <form action={drawWinner}>
              <input type="hidden" name="raffleId" value={active.id} />
              <button
                disabled={entriesError || totalEntries === 0}
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

          {entriesError && <p role="alert" className="mt-4 text-sm text-red-400">No pudimos cargar los participantes. Esperá a que se actualice la lista antes de sortear.</p>}

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
                {totalEntries > 60 && (
                  <span className="px-2 py-1 text-xs text-zinc-500">
                    +{totalEntries - 60} más
                  </span>
                )}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-zinc-500">
            La lista se actualiza sola cada 5 segundos.
          </p>
        </section>
      ))}

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
                    {r.platform === 'TWITCH' ? 'Twitch' : 'Kick'} ·{' '}
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
