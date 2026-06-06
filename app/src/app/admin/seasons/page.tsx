import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createSeason, closeSeason } from '@/app/actions/seasons'
import { Calendar, CheckCircle2, XCircle, Plus } from 'lucide-react'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

export default async function AdminSeasonsPage() {
  const admin = adminClient()

  const { data: seasons } = await admin
    .from('seasons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  const activeSeason = (seasons ?? []).find((s: any) => s.status === 'ACTIVE')

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Temporadas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cada temporada cierra exactamente a las 00:00 UTC del 1º del siguiente mes.
        </p>
      </div>

      {/* Crear nueva temporada */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Nueva temporada
        </h2>

        {activeSeason ? (
          <div className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-4 py-3">
            Ya hay una temporada activa: <strong>{activeSeason.name}</strong>. Ciérrala antes de crear una nueva.
          </div>
        ) : (
          <form action={createSeason} className="flex gap-3">
            <input
              name="name"
              placeholder="Ej: Temporada 2 — Verano"
              required
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
            >
              Crear
            </button>
          </form>
        )}

        {/* Preview de cuándo cerrará */}
        {!activeSeason && (() => {
          const now   = new Date()
          const year  = now.getUTCFullYear()
          const month = now.getUTCMonth()
          const closes = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0))
          return (
            <p className="text-xs text-muted-foreground mt-3">
              Se creará ahora y cerrará el{' '}
              <span className="text-foreground font-medium">
                {closes.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })} a las 00:00 UTC
              </span>
            </p>
          )
        })()}
      </div>

      {/* Lista de temporadas */}
      <div className="space-y-3">
        {(seasons ?? []).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-30" />
            Sin temporadas aún.
          </div>
        ) : (
          (seasons as any[]).map((s: any) => {
            const isActive = s.status === 'ACTIVE'
            return (
              <div
                key={s.id}
                className={`bg-card border rounded-2xl p-5 flex items-center gap-4 ${
                  isActive ? 'border-primary/30' : 'border-border opacity-70'
                }`}
              >
                <div className="shrink-0">
                  {isActive
                    ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                    : <XCircle className="w-5 h-5 text-muted-foreground" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(s.starts_at)} → {fmtDate(s.ends_at)}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-green-400/15 text-green-400'
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {isActive ? 'ACTIVA' : 'CERRADA'}
                  </span>

                  {isActive && (
                    <form action={async () => {
                      'use server'
                      await closeSeason(s.id)
                    }}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-400/10 border border-red-400/20 transition-colors"
                      >
                        Cerrar temporada
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
