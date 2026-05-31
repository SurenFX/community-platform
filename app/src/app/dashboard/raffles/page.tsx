import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Ticket, Youtube, Tv, Trophy } from 'lucide-react'

export default async function RafflesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, user_reputation(raffle_tickets)')
    .eq('id', user.id)
    .single() as any as { data: { is_admin: boolean; user_reputation: { raffle_tickets: number } | null } | null }

  const myTickets = (profile as any)?.user_reputation?.raffle_tickets ?? 0
  const isAdmin   = profile?.is_admin ?? false

  const raffleTypes = [
    {
      id:          'youtube',
      title:       'Sorteo en YouTube',
      description: 'Sorteá entre los comentarios de cualquier video del canal',
      icon:        Youtube,
      color:       'text-red-400',
      bg:          'bg-red-400/10',
      border:      'border-red-400/20 hover:border-red-400/50',
      href:        '/dashboard/raffles/youtube',
      available:   true,
      badge:       'Disponible',
      badgeColor:  'bg-green-400/15 text-green-400',
    },
    {
      id:          'twitch',
      title:       'Sorteo en Twitch',
      description: 'Los viewers escriben una keyword en el chat para participar',
      icon:        Tv,
      color:       'text-purple-400',
      bg:          'bg-purple-400/10',
      border:      'border-purple-400/20 hover:border-purple-400/50',
      href:        '/dashboard/raffles/twitch',
      available:   isAdmin,
      badge:       isAdmin ? 'Solo admins' : 'Solo admins',
      badgeColor:  isAdmin ? 'bg-purple-400/15 text-purple-400' : 'bg-secondary text-muted-foreground',
    },
    {
      id:          'platform',
      title:       'Sorteo de la plataforma',
      description: 'Sorteá entre los miembros con tickets acumulados por actividad',
      icon:        Trophy,
      color:       'text-yellow-400',
      bg:          'bg-yellow-400/10',
      border:      'border-yellow-400/20 hover:border-yellow-400/50',
      href:        '/dashboard/raffles/platform',
      available:   true,
      badge:       'Disponible',
      badgeColor:  'bg-green-400/15 text-green-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sorteos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Elegí el tipo de sorteo</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-lg font-bold text-foreground">{myTickets}</p>
            <p className="text-xs text-muted-foreground">tickets disponibles</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {raffleTypes.map(({ id, title, description, icon: Icon, color, bg, border, href, available, badge, badgeColor }) => (
          <div key={id} className={`bg-card border rounded-2xl p-6 transition-all duration-200 ${available ? `${border} cursor-pointer` : 'border-border opacity-60 cursor-not-allowed'}`}>
            {available ? (
              <Link href={href} className="block h-full space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${badgeColor}`}>{badge}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </Link>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${badgeColor}`}>{badge}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
