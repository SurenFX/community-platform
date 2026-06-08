import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotificacionesClient from './NotificacionesClient'

export default async function NotificacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <NotificacionesClient
      initialNot