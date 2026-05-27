'use client'

import { useEffect, useState } from 'react'
import { getLevelTitle, getLevelColor } from '@/lib/utils'
import { Trophy } from 'lucide-react'

interface LevelUpModalProps {
  oldLevel: number
  newLevel: number
  onClose:  () => void
}

export default function LevelUpModal({ oldLevel, newLevel, onClose }: LevelUpModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    // Auto-cerrar a los 6 segundos
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 6000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        transition-all duration-300
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
      />

      {/* Modal */}
      <div
        className={`
          relative bg-card border border-primary/40 rounded-2xl p-8 text-center
          max-w-sm w-full shadow-2xl level-glow
          transition-all duration-500
          ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'}
        `}
      >
        {/* Ícono */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4 mx-auto">
          <Trophy className="w-8 h-8 text-primary" />
        </div>

        <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
          ¡Subiste de nivel!
        </p>

        <div className="flex items-center justify-center gap-4 my-4">
          <div className="text-center">
            <p className="text-3xl font-black text-muted-foreground">{oldLevel}</p>
            <p className="text-xs text-muted-foreground mt-1">{getLevelTitle(oldLevel)}</p>
          </div>
          <div className="text-2xl text-primary font-bold">→</div>
          <div className="text-center">
            <p className={`text-5xl font-black ${getLevelColor(newLevel)}`}>{newLevel}</p>
            <p className={`text-sm font-semibold mt-1 ${getLevelColor(newLevel)}`}>
              {getLevelTitle(newLevel)}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Seguí participando para desbloquear más recompensas
        </p>

        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl transition-all duration-200"
        >
          ¡Gracias!
        </button>
      </div>
    </div>
  )
}
