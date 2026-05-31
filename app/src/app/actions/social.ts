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
