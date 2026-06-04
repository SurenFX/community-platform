import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Trophy, Target, Ticket, Award, Users, TrendingUp, MessageSquare, Tv, Youtube } from 'lucide-react'
import { getLevelTitle, getLevelColor } from '@/lib/utils'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [totalRes, topRes, statsRes] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('user_reputation')
      .select('level, total_xp, profiles!inner(username, avatar_url)')
      .order('total_xp', { ascending: false })
      .limit(5),
    admin.from('xp_events').select('id', { count: 'exact', head: true }),
  ])

  const totalMembers = totalRes.count ?? 0
  const totalEvents  = statsRes.count ?? 0
  const topMembers   = topRes.data ?? []

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground tracking-wide">COMMUNITY</span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">BETA</span>
          </div>
          <Link href="/login"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm transition-all hover:scale-105 btn-glow">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Unirme
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center relative">
        {/* Glow fondo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-soft" />
            Comunidad activa · {totalMembers} miembros
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-foreground mb-6 leading-tight tracking-tight">
            Tu actividad tiene
            <span className="text-primary"> recompensa</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Ganá XP por participar en Discord, Twitch, YouTube y Telegram. Subí de nivel, desbloqueá badges y competí en el ranking de la comunidad.
          </p>

          <Link href="/login"
            className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-[#5865F2]/20">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Entrar con Discord — es gratis
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 border-y border-border/50 bg-card/30">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: totalMembers,            label: 'Miembros',      icon: Users       },
            { value: totalEvents.toLocaleString(), label: 'Acciones con XP', icon: TrendingUp },
            { value: '4',                     label: 'Plataformas',   icon: MessageSquare },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label}>
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top miembros */}
      {topMembers.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-2">Top de la comunidad</h2>
              <p className="text-muted-foreground text-sm">Los miembros más activos este momento</p>
            </div>
            <div className="space-y-3">
              {topMembers.map((member: any, i: number) => (
                <div key={i} className={`flex items-center gap-4 bg-card border rounded-2xl px-5 py-4 ${i === 0 ? 'border-yellow-400/30 gradient-border' : 'border-border'}`}>
                  <div className="w-8 text-center shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm font-bold text-muted-foreground">#{i+1}</span>}
                  </div>
                  {member.profiles?.avatar_url ? (
                    <img src={member.profiles.avatar_url} alt={member.profiles.username} className="w-10 h-10 rounded-xl shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{member.profiles?.username?.[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{member.profiles?.username}</p>
                    <p className={`text-xs font-medium ${getLevelColor(member.level)}`}>
                      Nv. {member.level} · {getLevelTitle(member.level)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">{member.total_xp.toLocaleString()} XP</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 px-6 bg-card/20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">¿Cómo funciona?</h2>
            <p className="text-muted-foreground text-sm">Conectá tus cuentas y empezá a ganar</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {[
              { icon: MessageSquare, color: 'text-indigo-400',    bg: 'bg-indigo-400/10',    title: 'Discord',  desc: 'Mensajes, reacciones y participación en el servidor' },
              { icon: Tv,            color: 'text-purple-400',  bg: 'bg-purple-400/10',  title: 'Twitch',   desc: 'Chat en streams, tiempo de visualización y raids' },
              { icon: Youtube,       color: 'text-red-400',     bg: 'bg-red-400/10',     title: 'YouTube',  desc: 'Comentarios en videos del canal' },
              { icon: MessageSquare, color: 'text-[#26A5E4]',   bg: 'bg-[#26A5E4]/10',  title: 'Telegram', desc: 'Mensajes en el grupo de la comunidad' },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-6 card-hover">
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Trophy,  title: 'Ranking',   desc: 'Competí en rankings globales, semanales y mensuales' },
              { icon: Target,  title: 'Misiones',  desc: 'Misiones diarias y semanales con recompensas de XP y tickets' },
              { icon: Ticket,  title: 'Sorteos',   desc: 'Participá en sorteos exclusivos con los tickets que ganás' },
              { icon: Award,   title: 'Badges',    desc: 'Desbloqueá logros únicos por tu actividad en la comunidad' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 bg-card border border-border rounded-xl p-4 card-hover">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground mb-0.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-primary/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-xl mx-auto">
          <h2 className="text-3xl font-extrabold text-foreground mb-4">¿Listo para empezar?</h2>
          <p className="text-muted-foreground mb-8">Unite con tu cuenta de Discord y empezá a ganar XP hoy.</p>
          <Link href="/login"
            className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-[#5865F2]/20">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Entrar con Discord
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6 text-center">
        <p className="text-xs text-muted-foreground">Community Platform · Hecho con ❤️ para la comunidad</p>
      </footer>

    </div>
  )
}
