import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Gift, LogOut, Ticket, MessageSquare, Settings, Bell } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function signOut() {
  'use server'
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

const NAV = [
  { href: '/panel',           label: 'Inicio',   icon: Settings },
  { href: '/panel/sorteos',   label: 'Sorteos',  icon: Ticket },
  { href: '/panel/comandos',  label: 'Comandos', icon: MessageSquare },
  { href: '/panel/avisos',    label: 'Avisos',   icon: Bell },
  { href: '/panel/destinos',  label: 'Destinos', icon: MessageSquare },
]

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/panel" className="flex items-center gap-2">
          <Gift className="h-7 w-7 text-brand" />
          <span className="text-xl font-bold">Streamea</span>
        </Link>
        <form action={signOut}>
          <button className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </form>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-brand hover:text-white"
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}
