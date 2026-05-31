'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Trophy, Target,
  User, LogOut, Settings, Shield, Sliders,
} from 'lucide-react'
import SidebarXpBar from './SidebarXpBar'
import type { Profile, UserReputation } from '@/types/database'

interface SidebarProps {
  profile: (Profile & { user_reputation: UserReputation | null }) | null
}

const navItems = [
  { href: '/dashboard',                 label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dashboard/leaderboard',     label: 'Leaderboard', icon: Trophy          },
  { href: '/dashboard/missions',        label: 'Misiones',    icon: Target          },
  { href: '/dashboard/settings',        label: 'Mis cuentas', icon: Sliders         },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-40">

      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-foreground text-sm tracking-wide uppercase">
              Community
            </span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full tracking-wide">
              BETA
            </span>
          </div>
        </div>
      </div>

      {profile && (
        <div className="p-4 border-b border-border">
          <SidebarXpBar
            userId={profile.id}
            initialRep={profile.user_reputation}
            username={profile.username}
            avatarUrl={profile.avatar_url}
          />
        </div>
      )}

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/25 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
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
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                pathname.startsWith('/admin')
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              )}
            >
              <Settings className="w-4 h-4 shrink-0" />
              Panel Admin
            </Link>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border space-y-0.5">
        <Link href={`/dashboard/profile/${profile?.username}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-150"
        >
          <User className="w-4 h-4 shrink-0" />
          Mi perfil
        </Link>
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
