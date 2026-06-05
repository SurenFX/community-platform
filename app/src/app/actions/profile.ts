'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const username = (formData.get('username') as string)?.trim()
  const bio      = ((formData.get('bio') as string) || '').trim() || null

  if (!username || username.length < 3 || username.length > 20) {
    return { error: 'El username debe tener entre 3 y 20 caracteres' }
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: 'El username solo puede contener letras, números y _' }
  }

  const admin = getAdmin()

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()

  if (existing) {
    return { error: 'Ese username ya está en uso' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ username, bio })
    .eq('id', user.id)

  if (error) {
    console.error('updateProfile error:', error)
    return { error: `No se pudo actualizar el perfil: ${error.message}` }
  }

  return { success: true, username }
}

export const updateProfileAction = updateProfile

export async function completeOnboarding() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await (supabase
    .from('profiles')
    .update({ onboarding_completed: true } as any)
    .eq('id', user.id) as any)
}
