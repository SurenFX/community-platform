import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ExternalLink, Database, Zap, Server, Globe, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

async function getRedisInfo(): Promise<{ keys: number | null; usedMemory: string | null; error?: string }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { keys: null, usedMemory: null, error: 'Agregá UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN como env vars en Vercel' }

  try {
    const [dbsizeRes, infoRes] = await Promise.all([
      fetch(`${url}/dbsize`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      fetch(`${url}/info/memory`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
    ])
    const dbsize = await dbsizeRes.json()
    const info   = await infoRes.json()
    const memMatch = String(info.result ?? '').match(/used_memory_human:(\S+)/)
    return {
      keys:       typeof dbsize.result === 'number' ? dbsize.result : null,
      usedMemory: memMatch ? memMatch[1] : null,
    }
  } catch (e) {
    return { keys: null, usedMemory: null, error: String(e) }
  }
}

async function getDbSize(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  try {
    const tables = ['profiles', 'xp_events', 'notifications', 'user_missions', 'user_badges', 'user_inventory']
    const counts = await Promise.all(
      tables.map(t => admin.from(t).select('*', { count: 'exact', head: true }))
    )
    const total = counts.reduce((s, r) => s + (r.count ?? 0), 0)
    return `~${total.toLocaleString()} filas`
  } catch {
    return '—'
  }
}

export default async function InfraestructuraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  const [dbSize, redisInfo] = await Promise.all([
    getDbSize(admin),
    getRedisInfo(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Infraestructura</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Uso de hosting, base de datos y servicios externos
        </p>
      </div>

      {/* Supabase */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" /> Supabase — Base de datos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Filas totales (estimado)" value={dbSize} sub="Tablas principales" />
          <StatCard label="Proyecto"   value="lfkleoanvgdekfowxeex" sub="Plan: Free" />
          <StatCard label="Región"     value="sa-east-1" sub="São Paulo" />
        </div>
      </section>

      {/* Redis */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Upstash Redis
        </h2>
        {redisInfo.error ? (
          <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{redisInfo.error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Keys activas"  value={redisInfo.keys      ?? '—'} sub="Locks, IDs de mensajes, dedup" />
            <StatCard label="Memoria usada" value={redisInfo.usedMemory ?? '—'} sub="Límite: 256MB (Free)" />
          </div>
        )}
      </section>

      {/* Links externos */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Dashboards de servicios
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExternalCard
            name="Supabase — Usage"
            url="https://supabase.com/dashboard/project/lfkleoanvgdekfowxeex/settings/usage"
            description="Storage, bandwidth, conexiones Realtime y Auth MAU"
            icon={Database}
            color="bg-emerald-600"
          />
          <ExternalCard
            name="Vercel — Billing / Usage"
            url="https://vercel.com/community-platform-s-projects/community-platform-app/settings/billing"
            description="Bandwidth, Edge Function invocations, build minutes"
            icon={Globe}
            color="bg-zinc-700"
          />
          <ExternalCard
            name="Upstash — Dashboard"
            url="https://console.upstash.com"
            description="Comandos diarios, throughput, historial de uso"
            icon={Zap}
            color="bg-purple-600"
          />
          <ExternalCard
            name="Fly.io — Worker"
            url="https://fly.io/apps/worker-marbled-acorn-591/monitoring"
            description="CPU, RAM, logs en tiempo real del worker (NestJS)"
            icon={Server}
            color="bg-blue-600"
          />
        </div>
      </section>

      {/* Tabla de límites */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Límites plan gratuito
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Servicio</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Límite clave</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Señal de alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {([
                ['Supabase DB',       '500 MB storage · 2 GB bandwidth',          'Tabla xp_events crece rápido con muchos usuarios activos'],
                ['Supabase Realtime', '200 conexiones simultáneas · 2M msgs/mes', 'Muchos usuarios viendo el leaderboard al mismo tiempo'],
                ['Supabase Auth',     '50.000 MAU',                               'Login de usuarios activos por mes'],
                ['Vercel Hobby',      '100 GB bandwidth/mes',                     'Tráfico alto o imágenes sin CDN propio'],
                ['Upstash Redis',     '10.000 cmds/día · 256 MB',                 'Sorteos con mucha participación + crons cada 4h'],
                ['Fly.io',            'shared-cpu-1x · 256 MB RAM',               'Picos de webhooks simultáneos Kick + Twitch + Discord'],
              ] as [string, string, string][]).map(([srv, limit, alert]) => (
                <tr key={srv} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{srv}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{limit}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{alert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
