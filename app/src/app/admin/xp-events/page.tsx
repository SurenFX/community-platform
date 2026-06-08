import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createXpEvent, deleteXpEvent } from '@/app/actions/xpEvents'
import { Zap, Trash2, Plus } from 'lucide-react'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC'
}

export default async function AdminXpEventsPage() {
  const { data: events } = await admin()
    .from('global_xp_events')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(20)

  const now    = new Date().toISOString()
  const active = (events ?? []).filter((e: any) => e.starts_at <= now && e.ends_at >= now)
  const past   = (events ?? []).filter((e: any) => e.ends_at   <  now)
  const future = (events ?? []).filter((e: any) => e.starts_at >  now)

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" /> Eventos de XP Global
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea eventos de XP doble o triple para toda la comunidad. El banner aparece en el dashboard mientras el evento este activo.
        </p>
      </div>

      {/* Crear nuevo */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Nuevo evento
        </h2>
        <form action={createXpEvent} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Titulo</label>
              <input name="title" required placeholder="Fin de semana XP doble"
                className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Descripcion (opcional)</label>
              <input name="description" placeholder="Este fin de semana gana el doble de XP en todas las plataformas"
                className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Multiplicador</label>
              <select name="multiplier" required
                className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="1.5">x1.5 XP</option>
                <option value="2" selected>x2 XP (doble)</option>
                <option value="3">x3 XP (triple)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">&nbsp;</label>
              <p className="mt-1 text-xs text-muted-foreground pt-2">
                El multiplicador se aplica visualmente en el banner. La logica de aplicacion al XP debe configurarse en el worker.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Inicio (UTC)</label>
              <input name="starts_at" type="datetime-local" required
                className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Fin (UTC)</label>
              <input name="ends_at" type="datetime-local" required
                className="mt-1 w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <button type="submit"
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" /> Crear evento
          </button>
        </form>
      </div>

      {/* Activos */}
      {active.length > 0 && (
        <Section title="Activos ahora" color="text-green-400" events={active} />
      )}

      {/* Futuros */}
      {future.length > 0 && (
        <Section title="Programados" color="text-blue-400" events={future} />
      )}

      {/* Pasados */}
      {past.length > 0 && (
        <Section title="Finalizados" color="text-muted-foreground" events={past} />
      )}
    </div>
  )
}

function Section({ title, color, events }: { title: string; color: string; events: any[] }) {
  return (
    <div>
      <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 ${color}`}>{title}</h2>
      <div className="space-y-2">
        {events.map((e: any) => (
          <div key={e.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{e.title}</span>
                <span className="text-xs font-black bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded-full">
                  x{e.multiplier} XP
                </span>
              </div>
              {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">
                {fmtDate(e.starts_at)} → {fmtDate(e.ends_at)}
              </p>
            </div>
            <form action={deleteXpEvent.bind(null, e.id)}>
              <button type="submit"
                className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
