'use client'

import { useEffect } from 'react'
import { getRankTier } from '@/lib/utils'
import { X, TrendingUp } from 'lucide-react'

interface RankUpModalProps {
  newLevel: number
  prevLevel: number
  onClose: () => void
}

const TIER_EMOJI: Record<string, string> = {
  Hierro:   '⚙️',
  Bronce:   '🥉',
  Plata:    '🥈',
  Oro:      '🥇',
  Platino:  '💎',
  Diamante: '🔮',
  Maestro:  '👑',
}

export default function RankUpModal({ newLevel, prevLevel, onClose }: RankUpModalProps) {
  const newTier  = getRankTier(newLevel)
  const prevTier = getRankTier(prevLevel)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl scale-in overflow-hidden"
        style={{ border: `1.5px solid ${newTier.border.replace('border-', '').replace('/30', '')}`, boxShadow: `0 0 80px ${newTier.color.replace('text-', '').replace('-400', '')} / 0.3, 0 25px 50px -12px rgba(0,0,0,0.6)` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow bg */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at 50% 0%, ${newTier.bg.replace('bg-', '').replace('/10', '')} 0%, transparent 70%)`
        }} />

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <X className="w-4 h-4" />
        </button>

        {/* Badge animado */}
        <div className="text-7xl mb-4" style={{ animation: 'float 2s ease-in-out infinite' }}>
          {TIER_EMOJI[newTier.label] ?? '⭐'}
        </div>

        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          ¡Subiste de rango!
        </p>

        {/* Transicion de tier */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border opacity-60 ${prevTier.color} ${prevTier.bg} ${prevTier.border}`}>
            {prevTier.label}
          </span>
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
          <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${newTier.color} ${newTier.bg} ${newTier.border}`}
            style={{ animation: 'tier-pulse 2s ease-in-out infinite' }}>
            {newTier.label}
          </span>
        </div>

        <p className="text-muted-foreground text-sm mb-6">
          Alcanzaste el nivel <span className="font-bold text-foreground">{newLevel}</span> y desbloqueaste el rango
        </p>

        <button onClick={onClose} className={`w-full py-3 rounded-xl font-semibold text-sm transition-all border ${newTier.color} ${newTier.bg} ${newTier.border} hover:opacity-80`}>
          {TIER_EMOJI[newTier.label]} ¡A seguir subiendo!
        </button>
      </div>
    </div>
  )
}
