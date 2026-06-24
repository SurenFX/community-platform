import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExternalLink, Database, Zap, Server, Globe, AlertCircle, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

/* ──────────────────────────────────────────────
   Helpers
────────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function ExternalCard({
  name, url, description, icon: Icon, color,
}: { name: string; url: string; description: string; icon: any; color: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-start gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors group"
    >
      <div className={`p-2 rounded-lg ${color} shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
    </a>
  )
}

/* ──────────────────────────────────────────────
   Redis info via Upstash REST
────────────────────────────────────────────── */
async function getRedisInfo(): Promise<{ keys: number | null; usedMemory: string | null; error?: string }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { keys: null, usedMemory: null, error: 'Variables no configuradas en Vercel' }

  try {
    const [dbsizeRes, infoRes] = await Promise.all([
      fetch(`${url}/dbsize`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      fetch(`${url}/info/memory`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
    ])
    const dbsize = await dbsizeRes.json()
    const info   = await infoRes.json()

    // info.result es texto plano de Redis INFO
    const memMatch = String(info.result ?? '').match(/used_memory_human:(\S+)/)
    return {
      keys:       typeof dbsize.result === 'number' ? dbsize.result : null,
      usedMemory: memMatch ? memMatch[1] : null,
    }
  } catch (e) {
    return { keys: null, usedMemory: null, error: String(e) }
  }
}

/* ──────────────────────────────────────────────
   Page
────────────────────────────────────────────── */
export default async function InfraestructuraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verificar is_admin
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  // ── Métricas de DB ──
  const [
    { count: totalUsers },
    { count: totalXpEvents },
    { count: xpEventsHoy },
    { count: misionesCompletadas },
    { count: totalNotifs },
    { count: totalBadges },
    { data: dbSize },
    redisInfo,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('xp_events').select('*', { count: 'exact', head: true }),
    admin.from('xp_events').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    admin.from('user_missions').select('*', { count: 'exact', head: true }).eq('status', 'CLAIMED'),
    admin.from('notifications').select('*', { count: 'exact', head: true }),
    admin.from('user_badges').select('*', { count: 'exact', head: true }),
    admin.rpc('get_db_size' as any).maybeSingle(),
    getRedisInfo(),
  ])

  // Tamaño de DB via query directa si RPC no existe
  let dbSizeStr = '—'
  try {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .limit(1)
    // intentamos con rpc
    const { data: sizeData } = await (admin as any).rpc('pg_size_pretty', { size: 0 })
    dbSizeStr = sizeData ?? '—'
  } catch { /* ignorar */ }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Infraestructura</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Uso de servicios y métricas de la plataforma
        </p>
      </div>

      {/* ── Base de datos ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" /> Supabase — Base de datos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Usuarios registrados"    value={totalUsers     ?? 0} />
          <StatCard label="Eventos de XP (total)"  value={totalXpEvents  ?? 0} />
          <StatCard label="Eventos de XP (24h)"    value={xpEventsHoy    ?? 0} />
          <StatCard label="Misiones completadas"   value={misionesCompletadas ?? 0} />
          <StatCard label="Notificaciones"          value={totalNotifs    ?? 0} />
          <StatCard label="Badges otorgados"        value={totalBadges    ?? 0} />
        </div>
      </section>

      {/* ── Redis ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Upstash Redis
        </h2>
        {redisInfo.error ? (
          <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{redisInfo.error} — agregá <code className="font-mono text-xs">UPSTASH_REDIS_REST_URL</code> y <code className="font-mono text-xs">UPSTASH_REDIS_REST_TOKEN</code> como env vars en Vercel para ver estos datos.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Keys totales"   value={redisInfo.keys      ?? '—'} />
            <StatCard label="Memoria usada"  value={redisInfo.usedMemory ?? '—'} />
          </div>
        )}
      </section>

      {/* ── Links externos ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Dashboards externos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExternalCard
            name="Supabase — Usage"
            url="https://supabase.com/dashboard/project/lfkleoanvgdekfowxeex/settings/usage"
            description="Filas, storage, bandwidth de Realtime y Auth"
            icon={Database}
            color="bg-emerald-600"
          />
          <ExternalCard
            name="Vercel — Analytics"
            url="https://vercel.com/community-platform-s-projects/community-platform-app/analytics"
            description="Bandwidth, invocaciones de Edge Functions, latencia"
            icon={Globe}
            color="bg-zinc-700"
          />
          <ExternalCard
            name="Upstash Redis — Dashboard"
            url="https://console.upstash.com"
            description="Comandos diarios, throughput, latencia"
            icon={Zap}
            color="bg-purple-600"
          />
          <ExternalCard
            name="Fly.io — Worker"
            url="https://fly.io/apps/worker-marbled-acorn-591/monitoring"
            description="CPU, RAM, deploys y logs del worker"
            icon={Server}
            color="bg-blue-600"
          />
        </div>
      </section>

      {/* ── Límites del plan gratuito ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Límites plan gratuito (referencia)
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Servicio</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Límite</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Crítico cuando...</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                ['Supabase', '500MB DB · 5GB bandwidth · 50k MAU auth', 'Muchos usuarios con sesión activa'],
                ['Supabase Realtime', '200 conexiones simultáneas · 2M msgs/mes', 'Muchos usuarios viendo el leaderboard al mismo tiempo'],
                ['Vercel Hobby', '100GB bandwidth/mes · 100 deploys/día', 'Tráfico alto o imágenes pesadas sin CDN'],
                ['Upstash Redis', '10.000 cmds/día · 256MB', 'Sorteos con mucha participación + crons activos'],
                ['Fly.io', 'shared-cpu-1x · 256MB RAM · ~$1.94/mes', 'Picos de webhooks de Kick/Twitch simultáneos'],
              ].map(([srv, limit, critical]) => (
                <tr key={srv} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{srv}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{limit}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{critical}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
