'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const RARITY_STYLES: Record<string, { border: string; glow: string; label: string; labelColor: string }> = {
  LEGENDARY: { border: 'border-purple-400/60', glow: '0 0 40px rgba(168,85,247,0.4)',  label: 'Legendario', labelColor: 'text-purple-300' },
  GOLD:      { border: 'border-yellow-400/60', glow: '0 0 40px rgba(250,204,21,0.35)', label: 'Oro',        labelColor: 'text-yellow-300' },
  SILVER:    { border: 'border-slate-400/60',  glow: '0 0 30px rgba(148,163,184,0.3)', label: 'Plata',      labelColor: 'text-slate-300'  },
  BRONZE:    { border: 'border-amber-700/60',  glow: '0 0 30px rgba(180,83,9,0.3)',    label: 'Bronce',     labelColor: 'text-amber-400'  },
  EPIC:      { border: 'border-purple-500/60', glow: '0 0 35px rgba(168,85,247,0.35)', label: 'Épico',      labelColor: 'text-purple-300' },
  RARE:      { border: 'border-blue-500/60',   glow: '0 0 30px rgba(59,130,246,0.3)',  label: 'Raro',       labelColor: 'text-blue-300'   },
  UNCOMMON:  { border: 'border-green-500/60',  glow: '0 0 25px rgba(34,197,94,0.25)',  label: 'Poco común', labelColor: 'text-green-300'  },
  COMMON:    { border: 'border-border',        glow: 'none',                            label: 'Común',      labelColor: 'text-muted-foreground' },
}

interface Badge {
  id:          string
  name:        string
  description: string
  image_url:   string | null
  tier:        string | null
}

interface Props {
  badge:   Badge
  onClose: () => void
}

export default function BadgeUnlockModal({ badge, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const style = RARITY_STYLES[badge.tier ?? 'COMMON'] ?? RARITY_STYLES.COMMON

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-500 ${
        visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'
      }`}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-sm bg-card border-2 ${style.border} rounded-3xl p-8 text-center transition-all duration-500 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-8'
        }`}
        style={{ boxShadow: style.glow }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
          🏆 ¡Logro desbloqueado!
        </p>

        <div
          className="text-7xl mb-5 inline-block"
          style={{ filter: 'drop-shadow(0 0 12px currentColor)', animation: 'badge-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          {badge.image_url || '🏅'}
        </div>

        <h2 className="text-xl font-black text-foreground mb-1">{badge.name}</h2>
        <p className="text-sm text-muted-foreground mb-4">{badge.description}</p>

        {badge.tier && badge.tier !== 'COMMON' && (
          <span className={`text-xs font-bold uppercase tracking-wider ${style.labelColor}`}>
            {style.label}
          </span>
        )}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            ¡Genial!
          </button>
        </div>
      </div>

      <style>{`
        @keyframes badge-pop {
          0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(5deg);  opacity: 1; }
          100% { transform: scale(1)   rotate(0deg);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
