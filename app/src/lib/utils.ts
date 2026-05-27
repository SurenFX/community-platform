import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Calcular nivel desde XP total
// Fórmula: nivel = floor(sqrt(xp / 100)) + 1, techo en 100
export function xpToLevel(xp: number): number {
  return Math.min(Math.floor(Math.sqrt(xp / 100)) + 1, 100)
}

// XP necesario para llegar al siguiente nivel
export function xpForNextLevel(currentLevel: number): number {
  return Math.pow(currentLevel, 2) * 100
}

// XP acumulado al inicio del nivel actual
export function xpForCurrentLevel(currentLevel: number): number {
  return Math.pow(currentLevel - 1, 2) * 100
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

// Nombre del nivel según rango
export function getLevelTitle(level: number): string {
  if (level >= 75) return 'Legend'
  if (level >= 50) return 'Elite'
  if (level >= 25) return 'Core'
  if (level >= 10) return 'Regular'
  return 'Viewer'
}

// Color del nivel para badges y UI
export function getLevelColor(level: number): string {
  if (level >= 75) return 'text-yellow-400'
  if (level >= 50) return 'text-purple-400'
  if (level >= 25) return 'text-blue-400'
  if (level >= 10) return 'text-green-400'
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
