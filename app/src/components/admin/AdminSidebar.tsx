'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Target, Zap,
  BarChart3, ArrowLeft, Shield, Ticket, Award, CalendarDays, Swords, Flame, Skull, Dices, Gamepad2, Cpu,
} from 'lucide-react'

const navItems = [
  { href: '/admin',              label: 'Overview',    icon: LayoutDashboard, exact: true },
  { href: '/admin/users',        label: 'Usuarios',    icon: Users            },
  { href: '/admin/missions',     label: 'Misiones',    icon: Target           },
  { href: '/admin/badges',       label: 'Logros',      icon: Award            },
  { href: '/admin/xp-config',    label: 'Config XP',  icon: Zap              },
  { href: '/admin/raffles',      label: 'Sorteos',     icon: Ticket           },
  { href: '/admin/seasons',      label: 'Temporadas',  icon: CalendarDays     },
  { href: '/admin/challenges',   label: 'Desafios',    icon: Swords           },
  { href: '/admin/boss-raids',   label: 'Boss Raids',  icon: Skull            },
  { href: '/admin/rueda',        label: 'Rueda',       icon: Dices            },
  { href: '/admin/referidos',    label: 'Referidos',   icon: Gamepad2         },
  { href: '/admin/daily-bonus',  label: 'Bono diario', icon: Flame            },
  { href: '/admin/xp-events',    label: 'Eventos XP',  icon: Zap              },
  { href: '/admin/analytics',      label: 'Analytics',     icon: BarChart3        },
  { href: '/admin/infraestructura', label: 'Infraestructura', icon: Cpu              },
]

export default function AdminSidebar({ profile }: { profile: any }) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-card border-r border-border flex flex-col z-40">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm text-foreground">Admin Panel</span>
        </div>
        <p className="text-xs text-muted-foreground">{profile?.username}</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }: any) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Link href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al dashboard
        </Link>
      </div>
    </aside>
  )
}
