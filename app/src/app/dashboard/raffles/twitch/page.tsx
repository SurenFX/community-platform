import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TwitchRaffle from '@/components/raffles/TwitchRaffle'

export default async function TwitchRafflePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Solo admins
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as any as { data: { is_admin: boolean } | null }

  if (!profile?.is_admin) redirect('/dashboard')

  return <TwitchRaffle />
}
