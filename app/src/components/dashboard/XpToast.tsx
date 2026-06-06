'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'

interface XpToastProps {
  xp:    number
  label: string
}

export default function XpToast({ xp, label }: XpToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    const t2 = setTimeout(() => setVisible(false), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className={`
        relative flex items-center gap-3 bg-card border border-primary/40 rounded-xl px-4 py-3
        shadow-lg shadow-primary/15 overflow-hidden transition-all duration-300
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}
      `}
    >
      {/* Ícono con escala pop al entrar */}
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 scale-in">
        <Zap className="w-4 h-4 text-primary" />
      </div>

      <div>
        <p className="text-sm font-bold text-primary">+{xp} XP</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>

      {/* Barra de countdown */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-full bg-primary/50 origin-left"
        style={{ animation: 'shrink-x 3.5s linear forwards' }}
      />
    </div>
  )
}
