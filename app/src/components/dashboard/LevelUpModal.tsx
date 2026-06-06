'use client'

import { useEffect, useState } from 'react'
import { getLevelTitle, getLevelColor } from '@/lib/utils'
import { Trophy } from 'lucide-react'

interface LevelUpModalProps {
  oldLevel: number
  newLevel: number
  onClose:  () => void
}

const SPARKLES = [
  { top: '8%',  left: '12%', delay: '0ms',   color: '#00e5ff', tx: '-20px', ty: '-30px' },
  { top: '12%', right: '10%', delay: '120ms', color: '#fbbf24', tx: '20px',  ty: '-25px' },
  { top: '50%', left: '5%',  delay: '240ms', color: '#a78bfa', tx: '-25px', ty: '-15px' },
  { top: '50%', right: '5%', delay: '100ms', color: '#00e5ff', tx: '25px',  ty: '-15px' },
  { top: '75%', left: '15%', delay: '180ms', color: '#fbbf24', tx: '-15px', ty: '20px'  },
  { top: '75%', right: '15%',delay: '60ms',  color: '#a78bfa', tx: '15px',  ty: '20px'  },
  { top: '30%', left: '8%',  delay: '300ms', color: '#f472b6', tx: '-18px', ty: '-20px' },
  { top: '30%', right: '8%', delay: '200ms', color: '#34d399', tx: '18px',  ty: '-20px' },
]

export default function LevelUpModal({ oldLevel, newLevel, onClose }: LevelUpModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
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
          max-w-sm w-full shadow-2xl level-glow overflow-hidden
          transition-all duration-500
          ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-4'}
        `}
      >
        {/* Sparkles */}
        {visible && SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
            style={{
              top:         s.top,
              left:        (s as any).left,
              right:       (s as any).right,
              background:  s.color,
              '--tx':      s.tx,
              '--ty':      s.ty,
              animation:   `sparkle 0.9s ease-out ${s.delay} both`,
            } as React.CSSProperties}
          />
        ))}

        {/* Fondo glow sutil */}
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent pointer-events-none" />

        {/* Ícono flotando */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4 mx-auto float">
          <Trophy className="w-8 h-8 text-primary" />
        </div>

        <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
          ¡Subiste de nivel!
        </p>

        <div className="flex items-center justify-center gap-4 my-4">
          <div className="text-center opacity-60">
            <p className="text-3xl font-black text-muted-foreground">{oldLevel}</p>
            <p className="text-xs text-muted-foreground mt-1">{getLevelTitle(oldLevel)}</p>
          </div>

          <div className="text-2xl text-primary font-bold animate-bounce">→</div>

          <div className="text-center scale-in" style={{ animationDelay: '200ms' }}>
            <p className={`text-5xl font-black ${getLevelColor(newLevel)}`}
               style={{ textShadow: '0 0 20px currentColor' }}>
              {newLevel}
            </p>
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
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
        >
          ¡Gracias!
        </button>
      </div>
    </div>
  )
}
