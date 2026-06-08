'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import {
  Home, Trophy, Sword, Settings, LogOut, Shield, Ticket,
  CircleDollarSign, ShoppingBag, Swords, Menu, X,
} from 'lucide-react'

import SidebarXpBar from './SidebarXpBar'
import NotificationBell from './NotificationBell'
import type { Profile, UserReputation } from '@/types/database'

interface SidebarProps {
  profile: (Profile & { user_reputation: UserReputation | null } & {
    equipped_border_color?: string | null
    equipped_name_emoji?: string | null
    equipped_title_override?: string | null
  }) | null
  unreadNotifs?: number
}

const BORDER_COLOR_HEX: Record<string, string> = {
  'cyan-400':   '#22d3ee',
  'green-400':  '#4ade80',
  'violet-400': '#a78bfa',
  'red-500':    '#ef4444',
  'pink-400':   '#f472b6',
  'yellow-400': '#facc15',
  'orange-400': '#fb923c',
  'purple-500': '#a855f7',
}

const navItems = [
  { href: '/dashboard',               label: 'Inicio',         icon: Home,              exact: true },
  { href: '/dashboard/comunidad',     label: 'Ranking',        icon: Trophy                         },
  { href: '/dashboard/missions',      label: 'Quests',         icon: Sword                          },
  { href: '/dashboard/challenges',    label: 'Raids',          icon: Swords                         },
  { href: '/dashboard/raffles',       label: 'Sorteos',        icon: Ticket                         },
  { href: '/dashboard/shop',          label: 'Tienda',         icon: ShoppingBag                    },
  { href: '/dashboard/coins',          label: 'SalchiCoins',  icon: CircleDollarSign },
  { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings         },
]

export default function Sidebar({ profile, unreadNotifs = 0 }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const p = profile as any
  const borderHex  = BORDER_COLOR_HEX[p?.equipped_border_color ?? '']
  const nameEmoji  = p?.equipped_name_emoji ?? null

  const avatarStyle = borderHex
    ? { border: `2.5px solid ${borderHex}`, boxShadow: `0 0 10px ${borderHex}50` }
    : undefined

  const sidebarContent = (
    <aside className={cn(
      'fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-40',
      'transition-transform duration-300 ease-in-out',
      'md:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full'
    )}>

      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-xl">🌭</span>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="font-extrabold text-foreground tracking-tight text-sm">SalchiNeta</span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
              BETA
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell userId={profile?.id} />
            {/* Close button — mobile only */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Avatar + XP */}
      {profile && (
        <div className="p-4 border-b border-border">
          <Link
            href={`/dashboard/profile/${profile.username}`}
            className="flex items-center gap-3 mb-3 group rounded-xl hover:bg-secondary/60 transition-all p-1 -m-1"
            onClick={() => setMobileOpen(false)}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-9 h-9 rounded-xl transition-all"
                style={avatarStyle ?? { border: '2px solid hsl(var(--border))' }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center transition-all"
                style={avatarStyle ?? { border: '2px solid hsl(var(--border))' }}
              >
                <span className="text-sm font-bold text-primary">
                  {profile.username?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {nameEmoji && <span className="mr-1">{nameEmoji}</span>}
                {profile.username}
              </p>
              <p className="text-xs