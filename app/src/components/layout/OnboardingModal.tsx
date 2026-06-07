'use client'

import { useState, useEffect } from 'react'
import { X, Zap, Flame, ShoppingBag, CircleDollarSign, Swords, ChevronRight } from 'lucide-react'

const STEPS = [
  {
    icon:  '🌭',
    title: '¡Bienvenido a SalchiNeta!',
    body:  'Esta es la plataforma de la comunidad. Acá podés ver tu progreso, participar en desafíos y competir en el ranking.',
    color: 'text-primary',
    bg:    'bg-primary/10',
  },
  {
    icon:  '⚡',
    title: 'Ganás XP siendo activo',
    body:  'Chateá en Discord, mirá el stream, comentá en YouTube o participá en Telegram. Cada acción te da XP y sube tu nivel.',
    color: 'text-yellow-400',
    bg:    'bg-yellow-400/10',
  },
  {
    icon:  '🔥',
    title: 'Mantené tu racha diaria',
    body:  'Cada día que reclamás el bono diario suma a tu racha. Cuanto más larga la racha, más XP y SalchiCoins ganás.',
    color: 'text-orange-400',
    bg:    'bg-orange-400/10',
  },
  {
    icon:  '💰',
    title: 'SalchiCoins para la tienda',
    body:  'Con SalchiCoins podés comprar cosméticos: marcos de avatar, emojis de nombre y títulos personalizados.',
    color: 'text-primary',
    bg:    'bg-primary/10',
  },
  {
    icon:  '⚔️',
    title: 'Desafíos comunitarios',
    body:  'A veces habrá retos donde toda la comunidad tiene que acumular XP en conjunto. Si lo logran, ¡todos ganan recompensas!',
    color: 'text-green-400',
    bg:    'bg-green-400/10',
  },
]

const STORAGE_KEY = 'salchineta_onboarding_done'

export default function OnboardingModal({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setOpen(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!open) return null

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full xp-bar transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Close */}
          <div className="flex justify-end mb-4">
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl ${current.bg} flex items-center justify-center text-3xl mx-auto mb-5`}>
            {current.icon}
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-black text-foreground mb-2">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-secondary'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {step < STEPS.length - 1 ? (
              <>
                <button onClick={dismiss}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-all">
                  Saltear
                </button>
                <button onClick={next}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={dismiss}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all">
                ¡Empezar! 🌭
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
