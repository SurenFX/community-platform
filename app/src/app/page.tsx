import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sword, Trophy, Shield, Zap, Target, Ticket } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">

        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/20 border border-primary/30 mb-8">
          <Sword className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-5xl font-extrabold text-foreground mb-4 tracking-tight">
          Community Platform
        </h1>
        <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
          El hub de engagement y reputación para tu comunidad de streamers.
          Ganá XP, subí de nivel y entrá en los rankings.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold py-4 px-8 rounded-2xl text-lg transition-all duration-200 hover:scale-105"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Entrar con Discord
        </Link>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-20">
          {[
            { icon: Zap, title: 'Gana XP', desc: 'Por cada acción en Discord, Twitch y YouTube' },
            { icon: Trophy, title: 'Rankea', desc: 'Competí en rankings globales, semanales y mensuales' },
            { icon: Shield, title: 'Reputación', desc: 'Construí tu reputación en la comunidad' },
            { icon: Target, title: 'Misiones', desc: 'Completá misiones diarias y semanales' },
            { icon: Ticket, title: 'Sorteos', desc: 'Participá en sorteos con tus tickets de actividad' },
            { icon: Sword, title: 'Badges', desc: 'Desbloqueá logros únicos por tus hazañas' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-5 text-left">
              <Icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
