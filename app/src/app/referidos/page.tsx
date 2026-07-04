import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ReferidosClient from '../dashboard/referidos/ReferidosClient'

export const dynamic = 'force-dynamic'

export default async function ReferidosPublicPage() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: links } = await admin
    .from('referral_links')
    .select('id, game_name, game_image_url, referral_url, description, hide_name')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-10">

        {/* CTA — comunidad */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Comunidad SalchiNeta</p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
              Jugás, participás y ganás — todo en un mismo lugar
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Unite a la comunidad de Salchi: ganá <span className="text-foreground font-medium">XP y SalchiCoins</span> por chatear en Discord, ver streams en Twitch y Kick, comentar en YouTube y más. Subí de nivel, desbloqueá badges exclusivos y competí en el ranking global.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all duration-150 whitespace-nowrap"
            >
              Registrarse gratis →
            </Link>
          </div>
        </div>

        {/* Juegos */}
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Juegos recomendados</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Registrate en estos juegos usando el link de Salchi y apoyalo
            </p>
          </div>
          <ReferidosClient links={(links ?? []) as any} />
        </div>

      </div>
    </div>
  )
}
