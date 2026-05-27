import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, user_reputation(*)')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
