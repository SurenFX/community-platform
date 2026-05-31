import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Youtube, Tv, Trophy } from 'lucide-react'

export default async function AdminRafflesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raffleTypes = [
    {
      id: 'youtube', title: 'Sorteo en YouTube',
      description: 'Sorteá entre los comentarios de cualquier video del canal',
      icon: Youtube, color: 'text-red-400', bg: 'bg-red-400/10',
      border: 'border-red-400/20 hover:border-red-400/50',
      href: '/dashboard/raffles/youtube',
    },
    {
      id: 'twitch', title: 'Sorteo en Twitch',
      description: 'Los viewers escriben una keyword en el chat para participar',
      icon: Tv, color: 'text-purple-400', bg: 'bg-purple-400/10',
      border: 'border-purple-400/20 hover:border-purple-400/50',
      href: '/dashboard/raffles/twitch',
    },
    {
      id: 'platform', title: 'Sorteo de la plataforma',
      description: 'Sorteá entre miembros con tickets acumulados',
      icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
      href: '#', comingSoon: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sorteos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gestioná los sorteos de la comunidad</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {raffleTypes.map(({ id, title, description, icon: Icon, color, bg, border, href, comingSoon }) => (
          <div key={id} className={`bg-card border rounded-2xl p-6 transition-all duration-200 ${comingSoon ? 'border-border opacity-60 cursor-not-allowed' : `${border} cursor-pointer`}`}>
            {comingSoon ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-lg font-medium">Próximamente</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ) : (
              <Link href={href} className="block space-y-4">
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
