import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Calcular nivel desde XP total
// Fórmula: curva gradual — XP por nivel = 25*(n+5), empieza en 150 XP/nivel, techo en 200
// Acumulado: xpForLevel(n) = 12.5 * (n-1) * (n+10)
// Inversa:   n = floor((-9 + sqrt(121 + xp/3.125)) / 2)
export function xpToLevel(xp: number): number {
  return Math.min(Math.floor((-9 + Math.sqrt(121 + xp / 3.125)) / 2), 200)
}

// XP acumulado al inicio del nivel n+1 (= cuánto XP total se necesita para llegar al siguiente)
export function xpForNextLevel(currentLevel: number): number {
  return 12.5 * currentLevel * (currentLevel + 11)
}

// XP acumulado al inicio del nivel actual
export function xpForCurrentLevel(currentLevel: number): number {
  return 12.5 * (currentLevel - 1) * (currentLevel + 10)
}

// Progreso dentro del nivel actual (0-100)
export function levelProgress(xp: number): number {
  const level = xpToLevel(xp)
  const currentLevelXp = xpForCurrentLevel(level)
  const nextLevelXp = xpForNextLevel(level)
  const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
  return Math.min(Math.max(progress, 0), 100)
}

// Formatear número con K/M
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// Nombre del nivel según rango (15 tiers, cap 200)
export function getLevelTitle(level: number): string {
  if (level >= 200) return 'SalchiNeta'
  if (level >= 175) return 'Celestial'
  if (level >= 150) return 'Trascendente'
  if (level >= 125) return 'Ascendido'
  if (level >= 100) return 'Mítico'
  if (level >= 80)  return 'Inmortal'
  if (level >= 65)  return 'Leyenda'
  if (level >= 50)  return 'Maestro'
  if (level >= 38)  return 'Élite'
  if (level >= 28)  return 'Dedicado'
  if (level >= 20)  return 'Veterano'
  if (level >= 13)  return 'Fanático'
  if (level >= 8)   return 'Habitual'
  if (level >= 4)   return 'Seguidor'
  return 'Espectador'
}

// Color del nivel para badges y UI
export function getLevelColor(level: number): string {
  if (level >= 200) return 'text-yellow-300'
  if (level >= 175) return 'text-sky-300'
  if (level >= 150) return 'text-violet-300'
  if (level >= 125) return 'text-amber-300'
  if (level >= 100) return 'text-orange-400'
  if (level >= 80)  return 'text-rose-400'
  if (level >= 65)  return 'text-pink-400'
  if (level >= 50)  return 'text-purple-400'
  if (level >= 38)  return 'text-indigo-400'
  if (level >= 28)  return 'text-blue-400'
  if (level >= 20)  return 'text-cyan-400'
  if (level >= 13)  return 'text-teal-400'
  if (level >= 8)   return 'text-emerald-400'
  if (level >= 4)   return 'text-green-400'
  return 'text-slate-400'
}

// Color del tier de badge
export function getBadgeTierColor(tier: string): string {
  const colors: Record<string, string> = {
    BRONZE: 'text-amber-600 border-amber-600',
    SILVER: 'text-slate-400 border-slate-400',
    GOLD: 'text-yellow-400 border-yellow-400',
    PLATINUM: 'text-cyan-400 border-cyan-400',
    LEGENDARY: 'text-purple-400 border-purple-400',
  }
  return colors[tier] ?? 'text-slate-400'
}

// Formatear fecha relativa
export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'ahora'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

// Tier de rango basado en nivel (estilo MOBA/Battle Royale)
export function getRankTier(level: number): { label: string; color: string; bg: string; border: string } {
  if (level >= 80)  return { label: 'Maestro',  color: 'text-rose-400',   bg: 'bg-rose-400/10',   border: 'border-rose-400/30'   }
  if (level >= 50)  return { label: 'Diamante', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30' }
  if (level >= 35)  return { label: 'Platino',  color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/30'   }
  if (level >= 20)  return { label: 'Oro',      color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' }
  if (level >= 10)  return { label: 'Plata',    color: 'text-slate-400',  bg: 'bg-slate-400/10',  border: 'border-slate-400/30'  }
  if (level >= 5)   return { label: 'Bronce',   color: 'text-amber-600',  bg: 'bg-amber-600/10',  border: 'border-amber-600/30'  }
  return               { label: 'Hierro',   color: 'text-slate-500',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30'  }
}
