'use client'

import { useEffect } from 'react'
import { getLevelColor, getLevelTitle } from '@/lib/utils'
import { X } from 'lucide-react'

interface LevelUpModalProps {
  level: number
  onClose: () => void
}

export default function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const title = getLevelTitle(level)
  const color = getLevelColor(level)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-primary/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl scale-in overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 60px hsl(185 100% 45% / 0.2), 0 25px 50px -12px rgba(0,0,0,0.5)' }}
      >
        {/* Glow background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(185 100% 45% / 0.12) 0%, transparent 70%)' }}
        />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Emoji animado */}
        <div className="text-6xl mb-4" style={{ animation: 'float 2s ease-in-out infinite' }}>🎉</div>

        {/* Título */}
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">¡Subiste de nivel!</p>

        {/* Nivel */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex-1 h-px bg-border" />
          <p className="text-5xl font-black text-foreground">{level}</p>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Título de nivel */}
        <p className={`text-xl font-bold mb-6 ${color}`}>{title}</p>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
        >
          ¡Genial! 🌭
        </button>
      </div>
    </div>
  )
}
