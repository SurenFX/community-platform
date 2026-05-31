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
    // Pequeño delay para que la animación de entrada se vea
    const t1 = setTimeout(() => setVisible(true), 50)
    const t2 = setTimeout(() => setVisible(false), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className={`
        flex items-center gap-3 bg-card border border-primary/30 rounded-xl px-4 py-3
        shadow-lg shadow-primary/10 transition-all duration-300
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        <Zap className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold text-primary">+{xp} XP</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
