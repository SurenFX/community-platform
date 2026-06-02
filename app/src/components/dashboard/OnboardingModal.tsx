'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Tv, Youtube, Zap, ChevronRight, X } from 'lucide-react'
import { completeOnboarding } from '@/app/actions/profile'

interface Props {
  username: string
  avatarUrl: string | null
}

const STEPS = [
  {
    icon:  Shield,
    color: 'text-primary',
    bg:    'bg-primary/10',
    title: '¡Bienvenido a la comunidad!',
    desc:  'Esta es tu plataforma para acumular XP, subir de nivel y participar en sorteos exclusivos siendo parte activa de la comunidad.',
  },
  {
    icon:  Tv,
    color: 'text-purple-400',
    bg:    'bg-purple-400/10',
    title: 'Conectá Twitch',
    desc:  'Vinculá tu cuenta de Twitch para ganar XP por chatear en los streams, tiempo de visualización y más.',
  },
  {
    icon:  Youtube,
    color: 'text-red-400',
    bg:    'bg-red-400/10',
    title: 'Conectá YouTube',
    desc:  'Vinculá tu cuenta de YouTube para ganar XP por comentar en los videos del canal.',
  },
  {
    icon:  Zap,
    color: 'text-yellow-400',
    bg:    'bg-yellow-400/10',
    title: '¡Empezá a ganar XP!',
    desc:  'Cuanto más activo seas en Discord, Twitch y YouTube, más XP ganás. Subí de nivel, desbloqueá badges y participá en sorteos exclusivos.',
  },
]

export default function OnboardingModal({ username, avatarUrl }: Props) {
  const [step,    setStep]    = useState(0)
  const [visible, setVisible] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isLast = step === STEPS.length - 1
  const { icon: Icon, color, bg, title, desc } = STEPS[step]

  async function dismiss(goToConfig = false) {
    setVisible(false)
    startTransition(async () => {
      await completeOnboarding()
      if (goToConfig) router.push('/dashboard/configuracion')
    })
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-lg" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{username[0]?.toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm font-semibold text-foreground">{username}</span>
          </div>
          <button onClick={() => dismiss(false)} disabled={isPending}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 pb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-primary' : 'bg-border'
            }`} />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          <div className={`w-16 h-16 rounded-2xl ${bg} flex items-center justify-center`}>
            <Icon className={`w-8 h-8 ${color}`} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
          </div>

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                Atrás
              </button>
            )}
            <button
              onClick={() => isLast ? dismiss(true) : setStep(s => s + 1)}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
            >
              {isLast ? 'Conectar cuentas' : 'Siguiente'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
