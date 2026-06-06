import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  renameSeason, setNextSeasonName, closeSeason,
  closeAndRotate, createSeason,
} from '@/app/actions/seasons'
import { Calendar, CheckCircle2, XCircle, RefreshCw, Plus, Clock, Pencil } from 'lucide-react'

function adminClient() {
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

export default async function AdminSeasonsPage() {
  const admin = adminClient()

  const [{ data: seasons }, { data: nextNameConfig }] = await Promise.all([
    admin.from('seasons').select('*').order('created_at', { ascending: false }).limit(20),
    admin.from('platform_config').select('value').eq('key', 'next_season_name').maybeSingle(),
  ])

  const active   = (seasons ?? []).find((s: any) => s.status === 'ACTIVE') as any
  const history  = (seasons ?? []).filter((s: any) => s.status !== 'ACTIVE') as any[]
  const nextName = nextNameConfig?.value ?? ''

  // Calcular cuándo cerrará automáticamente la temporada activa
  const now = new Date()
  const autoClose = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Temporadas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Las temporadas rotan automáticamente el 1° de cada mes a las 00:05 UTC via pg_cron.
        </p>
      </div>

      {/* ── Temporada activa ── */}
      {active ? (
        <div className="bg-card border border-primary/30 rounded-2xl p-6 space-y-5"
          style={{ background: 'radial-gradient(ellipse at 0% 0%, hsl(185 100% 45% / 0.05) 0%, transparent 60%)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Temporada activa</span>
              <h2 className="text-lg font-black text-foreground mt-0.5">{active.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Desde {fmtDate(active.starts_at)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Cierre automático</p>
              <p className="text-sm font-bold text-foreground">
                {autoClose.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </p>
              <p className="text-xs text-primary">00:05 UTC</p>
            </div>
          </div>

          {/* Renombrar */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Pencil className="w-3 h-3" /> Renombrar temporada activa
            </p>
            <form action={renameSeason.bind(null, active.id)} className="flex gap-2">
              <input
                name="name"
                defaultValue={active.name}
                required
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
              <button type="submit"
                className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors shrink-0">
                Guardar
              </button>
            </form>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1 border-t border-border">
            <form action={closeAndRotate.bind(null, active.id)} className="flex-1">
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                <RefreshCw className="w-4 h-4" />
                Cerrar y crear la siguiente ahora
              </button>
            </form>
            <form action={closeSeason.bind(null, active.id)}>
              <button type="submit"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-colors">
                Solo cerrar
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Sin temporada activa — crear manualmente */
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold">
            <Clock className="w-4 h-4" />
            Sin temporada activa — el cron la creará el 1° del próximo mes, o creá una ahora:
          </div>
          <form action={createSeason} className="flex gap-2">
            <input
              name="name"
              placeholder="Ej: Temporada 1"
              required
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <button type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shrink-0 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Crear
            </button>
          </form>
        </div>
      )}

      {/* ── Configurar nombre de la próxima ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-bold text-foreground mb-1">Nombre de la próxima temporada</p>
        <p className="text-xs text-muted-foreground mb-3">
          Si lo dejás vacío, el cron usará "Temporada N" automáticamente.
        </p>
        <form action={setNextSeasonName} className="flex gap-2">
          <input
            name="next_name"
            defaultValue={nextName}
            placeholder="Ej: Temporada Verano 🌞"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <button type="submit"
            className="px-4 py-2 bg-secondary border border-border text-foreground rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors shrink-0">
            Guardar
          </button>
        </form>
        {nextName && (
          <p className="text-xs text-primary mt-2">
            ✓ Próxima temporada: <strong>{nextName}</strong>
          </p>
        )}
      </div>

      {/* ── Historial ── */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Historial</p>
          {history.map((s: any) => (
            <div key={s.id}
              className="bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-4 opacity-60">
              <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(s.starts_at)} → {fmtDate(s.ends_at)}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                CERRADA
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
