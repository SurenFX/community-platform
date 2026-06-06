'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import {
  Home, Trophy, Target, Settings, LogOut, Shield, Ticket, CircleDollarSign,
} from 'lucide-react'

import SidebarXpBar from './SidebarXpBar'
import NotificationBell from './NotificationBell'
import type { Profile, UserReputation } from '@/types/database'

interface SidebarProps {
  profile: (Profile & { user_reputation: UserReputation | null }) | null
}

const navItems = [
  { href: '/dashboard',               label: 'Inicio',         icon: Home,    exact: true },
  { href: '/dashboard/comunidad',     label: 'Ranking',        icon: Trophy               },
  { href: '/dashboard/missions',      label: 'Misiones',       icon: Target               },
  { href: '/dashboard/raffles',       label: 'Sorteos',        icon: Ticket               },
  { href: '/dashboard/coins',         label: 'SalchiCoins',    icon: CircleDollarSign     },
  { href: '/dashboard/configuracion', label: 'Configuración',  icon: Settings             },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-40">

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
          <NotificationBell userId={profile?.id} />
        </div>
      </div>

      {/* Avatar + XP — clickeable al perfil propio */}
      {profile && (
        <div className="p-4 border-b border-border">
          <Link
            href={`/dashboard/profile/${profile.username}`}
            className="flex items-center gap-3 mb-3 group rounded-xl hover:bg-secondary/60 transition-all p-1 -m-1"
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-9 h-9 rounded-xl ring-2 ring-border group-hover:ring-primary/50 transition-all"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center ring-2 ring-border group-hover:ring-primary/50 transition-all">
                <span className="text-sm font-bold text-primary">
                  {profile.username?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{profile.username}</p>
              <p className="text-xs text-muted-foreground">Ver perfil</p>
            </div>
          </Link>
          <SidebarXpBar
            userId={profile.id}
            initialRep={profile.user_reputation}
            username={profile.username}
            avatarUrl={profile.avatar_url}
            compact
          />
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'nav-item',
                isActive ? 'active' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
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
              className={cn('nav-item', pathname.startsWith('/admin') ? 'active' : 'text-muted-foreground')}
            >
              <Shield className="w-4 h-4 shrink-0" />
              Panel Admin
            </Link>
          </>
        )}
      </nav>

      {/* Footer — solo cerrar sesión */}
      <div className="p-3 border-t border-border">
        <form action={signOut}>
          <button type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>

    </aside>
  )
}
