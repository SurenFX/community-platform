import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import OnboardingModal from '@/components/layout/OnboardingModal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: unreadNotifs }] = await Promise.all([
    supabase.from('profiles').select('*, user_reputation(*)').eq('id', user.id).single(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
  ])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} unreadNotifs={unreadNotifs ?? 0} />
      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 mt-14 md:mt-0">
        {children}
      </main>
      <OnboardingModal username={(profile as any)?.username ?? ''} />
    </div>
  )
}
