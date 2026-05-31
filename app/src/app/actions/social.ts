'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function disconnectSocialLink(platform: string): Promise<{ error?: string }> {
  // Verificar sesión del usuario
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Usar admin client para bypassear RLS en el delete
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('user_social_links')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', platform)

  if (error) {
    console.error('disconnectSocialLink error:', error.message)
    return { error: 'No se pudo desconectar la cuenta' }
  }

  return {}
}

export async function setUserAdmin(targetUserId: string, isAdmin: boolean): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que el solicitante es admin
  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!me?.is_admin) return { error: 'Sin permisos' }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', targetUserId)

  if (error) {
    console.error('setUserAdmin error:', error.message)
    return { error: 'No se pudo actualizar el rol' }
  }
  return {}
}

export async function setUserBanned(targetUserId: string, isBanned: boolean): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!me?.is_admin) return { error: 'Sin permisos' }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('profiles')
    .update({ is_banned: isBanned })
    .eq('id', targetUserId)

  if (error) {
    console.error('setUserBanned error:', error.message)
    return { error: 'No se pudo actualizar el estado' }
  }
  return {}
}
