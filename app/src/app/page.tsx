import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Trophy, Target, Ticket, Award, Users, TrendingUp, Flame } from 'lucide-react'
import { getLevelTitle, getLevelColor, formatNumber } from '@/lib/utils'

const DiscordIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
)

const TelegramIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const week7 = new Date(Date.now() - 7 * 86400000).toISOString()

  const [totalRes, topRes, totalXpRes, missionsRes, badgesRes, activeRes] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('user_reputation')
      .select('level, total_xp, profiles!inner(username, avatar_url)')
      .order('total_xp', { ascending: false })
      .limit(5),
    // Suma de XP en DB, no en JS
    admin.rpc('get_total_xp_awarded').single(),
    admin.from('user_missions').select('id', { count: 'exact', head: true }).eq('is_completed', true),
    admin.from('user_badges').select('id',  { count: 'exact', head: true }),
    admin.from('xp_events').select('user_id').gte('created_at', week7),
  ])

  const totalMembers      = totalRes.count ?? 0
  const topMembers        = topRes.data ?? []
  // Fallback a 0 si el RPC no existe aún
  const totalXp           = (totalXpRes.data as any)?.total ?? 0
  const missionsCompleted = missionsRes.count ?? 0
  const badgesEarned      = badgesRes.count ?? 0
  const activeThisWeek    = new Set((activeRes.data ?? []).map((e: any) => e.user_id)).size

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌭</span>
            <span className="font-extrabold text-foreground tracking-tight">SalchiNeta</span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">BETA</span>
          </Link>
          <Link href="/login"
            className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all hover:scale-105 shadow-lg shadow-[#5865F2]/20">
            <DiscordIcon />
            Unirme gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 text-center relative overflow-hidden">
        {/* Glows de fondo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-32 left-1/4 w-[300px] h-[200px] bg-[#5865F2]/8 rounded-full blur-3xl" />
          <div className="absolute top-32 right-1/4 w-[300px] h-[200px] bg-yellow-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto fade-in-up">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-soft" />
            {totalMembers} miembros · {activeThisWeek} activos esta semana
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-foreground mb-6 leading-tight tracking-tight">
            Tu actividad tiene
            <br />
            <span className="text-primary">recompensa</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Ganá XP por participar en Discord, Twitch, YouTube y Telegram.
            Subí de nivel, desbloqueá badges únicos y competí en el ranking.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login"
              className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-200 hover:scale-105 shadow-xl shadow-[#5865F2]/25">
              <DiscordIcon />
              Entrar con Discord — es gratis
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Solo necesitás una cuenta de Discord</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 px-6 border-y border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8">
            Estadísticas de la comunidad
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { value: formatNumber(totalMembers),      label: 'Miembros',             icon: Users,   color: 'text-blue-400'   },
              { value: formatNumber(totalXp),           label: 'XP total otorgado',    icon: Zap,     color: 'text-yellow-400' },
              { value: formatNumber(missionsCompleted), label: 'Misiones completadas', icon: Target,  color: 'text-green-400'  },
              { value: formatNumber(badgesEarned),      label: 'Badges otorgados',     icon: Award,   color: 'text-purple-400' },
            ].map(({ value, label, icon: Icon, color }, i) => (
              <div key={label}
                className="bg-card border border-border rounded-2xl p-5 fade-in-up card-hover"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                <p className="text-2xl font-extrabold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top miembros */}
      {topMembers.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-2">Top de la comunidad</h2>
              <p className="text-muted-foreground text-sm">Los miembros más activos de la plataforma</p>
            </div>
            <div className="space-y-3">
              {topMembers.map((member: any, i: number) => (
                <div key={i}
                  className={`flex items-center gap-4 bg-card border rounded-2xl px-5 py-4 fade-in-up ${
                    i === 0 ? 'border-yellow-400/30 gradient-border' : 'border-border'
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="w-8 text-center shrink-0 text-lg">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' :
                      <span className="text-sm font-bold text-muted-foreground">#{i+1}</span>}
                  </div>
                  {member.profiles?.avatar_url ? (
                    <img src={member.profiles.avatar_url} alt={member.profiles.username}
                      className="w-10 h-10 rounded-xl shrink-0 ring-2 ring-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {member.profiles?.username?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{member.profiles?.username}</p>
                    <p className={`text-xs font-medium ${getLevelColor(member.level)}`}>
                      Nv. {member.level} · {getLevelTitle(member.level)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">{formatNumber(member.total_xp)} XP</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cómo funciona */}
      <section className="py-20 px-6 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">¿Cómo funciona?</h2>
            <p className="text-muted-foreground text-sm">Conectá tus cuentas y empezá a ganar XP en 4 plataformas</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {[
              { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>,
                color: 'text-[#5865F2]', bg: 'bg-[#5865F2]/10', title: 'Discord',
                desc: 'Mensajes, reacciones, voz y participación en el servidor' },
              { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>,
                color: 'text-purple-400', bg: 'bg-purple-400/10', title: 'Twitch',
                desc: 'Chat en streams, tiempo de visualización y raids' },
              { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
                color: 'text-red-400', bg: 'bg-red-400/10', title: 'YouTube',
                desc: 'Comentarios en videos del canal' },
              { icon: <TelegramIcon />, color: 'text-[#26A5E4]', bg: 'bg-[#26A5E4]/10', title: 'Telegram',
                desc: 'Mensajes y reacciones en el grupo de la comunidad' },
            ].map(({ icon, color, bg, title, desc }, i) => (
              <div key={title}
                className="bg-card border border-border rounded-2xl p-6 card-hover fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4 ${color}`}>
                  {icon}
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Trophy,     title: 'Ranking',   desc: 'Competí en rankings globales, semanales y mensuales' },
              { icon: Target,     title: 'Misiones',  desc: 'Completá misiones automáticas para ganar XP y SalchiCoins' },
              { icon: Ticket,     title: 'Sorteos',   desc: 'Participá en sorteos exclusivos de Twitch, YouTube y plataforma' },
              { icon: Award,      title: 'Badges',    desc: 'Desbloqueá logros únicos por tu actividad y antigüedad' },
              { icon: Flame,      title: 'Rachas',    desc: 'Mantené tu racha diaria y multiplicá tu XP' },
              { icon: TrendingUp, title: 'Niveles',   desc: '200 niveles con tiers exclusivos que desbloquean beneficios' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={title}
                className="flex items-start gap-4 bg-card border border-border rounded-xl p-4 card-hover fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
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
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-xl mx-auto fade-in-up">
          <div className="text-5xl mb-6">🌭</div>
          <h2 className="text-3xl font-extrabold text-foreground mb-4">¿Listo para empezar?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Unite con tu Discord y empezá a ganar XP hoy. Completamente gratis.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-10 rounded-2xl text-lg transition-all duration-200 hover:scale-105 shadow-xl shadow-[#5865F2]/25">
            <DiscordIcon />
            Entrar con Discord
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">🌭</span>
          <span className="text-sm font-bold text-muted-foreground">SalchiNeta</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacidad" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            Política de Privacidad
          </Link>
          <span className="text-border">·</span>
          <Link href="/terminos" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            Términos de Uso
          </Link>
          <span className="text-border">·</span>
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Entrar
          </Link>
        </div>
      </footer>

    </div>
  )
}
