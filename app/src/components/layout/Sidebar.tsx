'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import {
  Home, Trophy, Sword, Settings, LogOut, Shield, Ticket,
  CircleDollarSign, ShoppingBag, Swords, Menu, X, Dices, Gamepad2,
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
  { href: '/dashboard',               label: 'Dashboard',    icon: Home,              exact: true },
  { href: '/dashboard/comunidad',     label: 'Ranking',      icon: Trophy                         },
  { href: '/dashboard/missions',      label: 'Quests',       icon: Sword                          },
  { href: '/dashboard/challenges',    label: 'Raids',        icon: Swords                         },
  { href: '/dashboard/raffles',       label: 'Sorteos',      icon: Ticket                         },
  { href: '/dashboard/shop',          label: 'Tienda',       icon: ShoppingBag                    },
  { href: '/dashboard/rueda',         label: 'Rueda',        icon: Dices                          },
  { href: '/dashboard/coins',         label: 'SalchiCoins',  icon: CircleDollarSign               },
  { href: '/referidos',     label: 'Referidos',    icon: Gamepad2                       },
  { href: '/dashboard/configuracion', label: 'Configuracion', icon: Settings                      },
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

      {/* Navegacion */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              onClick={() => setMobileOpen(false)}
              className={cn('nav-item', isActive ? 'active' : 'text-muted-foreground')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
            </Link>
          )
        })}

        {profile?.is_admin && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3">
                Admin
              </p>
            </div>
            <Link href="/admin"
              onClick={() => setMobileOpen(false)}
              className={cn('nav-item', pathname.startsWith('/admin') ? 'active' : 'text-muted-foreground')}
            >
              <Shield className="w-4 h-4 shrink-0" />
              Panel Admin
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-3">
        {profile && (
          <div className="pb-2 border-b border-border/50">
            <SidebarXpBar
              userId={profile.id}
              initialRep={(profile as any).user_reputation ?? null}
              username={(profile as any).username ?? 'Usuario'}
              avatarUrl={(profile as any).avatar_url ?? null}
              avatarStyle={avatarStyle}
              nameEmoji={nameEmoji}
              onAvatarClick={() => setMobileOpen(false)}
            />
          </div>
        )}
        <form action={signOut}>
          <button type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Cerrar sesion
          </button>
        </form>
      </div>

    </aside>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center gap-3 px-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-xl">🌭</span>
        <span className="font-extrabold text-foreground text-sm tracking-tight">SalchiNeta</span>
      </div>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {sidebarContent}
    </>
  )
}
