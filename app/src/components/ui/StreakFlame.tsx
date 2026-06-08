import { cn } from '@/lib/utils'

interface StreakFlameProps {
  days: number
  showLabel?: boolean
  className?: string
}

function getFlameConfig(days: number) {
  if (days >= 30) return { emoji: '🔥', size: 'text-2xl', glow: 'drop-shadow-[0_0_8px_rgba(251,146,60,0.9)]', label: 'text-orange-300', pulse: 'animate-pulse', labelSize: 'text-sm' }
  if (days >= 14) return { emoji: '🔥', size: 'text-xl',  glow: 'drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]', label: 'text-orange-400', pulse: 'animate-pulse', labelSize: 'text-sm' }
  if (days >= 8)  return { emoji: '🔥', size: 'text-lg',  glow: 'drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]', label: 'text-orange-400', pulse: '',             labelSize: 'text-xs' }
  if (days >= 4)  return { emoji: '🔥', size: 'text-base',glow: '',                                             label: 'text-orange-400', pulse: '',             labelSize: 'text-xs' }
  return           { emoji: '🔥', size: 'text-sm',  glow: '',                                             label: 'text-orange-400/70', pulse: '',           labelSize: 'text-[10px]' }
}

export default function StreakFlame({ days, showLabel = true, className }: StreakFlameProps) {
  if (days < 1) return null
  const cfg = getFlameConfig(days)
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      <span className={cn(cfg.size, cfg.glow, cfg.pulse)}>{cfg.emoji}</span>
      {showLabel && (
        <span className={cn('font-bold', cfg.label, cfg.labelSize)}>{days}d</span>
      )}
    </span>
  )
}
