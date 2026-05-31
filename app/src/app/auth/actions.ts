'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const username = formData.get('username') as string
  const bio      = formData.get('bio') as string

  if (!username || username.length < 3 || username.length > 30) {
    return { error: 'El username debe tener entre 3 y 30 caracteres' }
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: 'El username solo puede contener letras, números y _' }
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .single()

  if (existing) {
    return { error: 'Ese username ya está en uso' }
  }

  // Usar cast explícito para evitar el error de tipos
  const { error } = await supabase
    .from('profiles')
    .update({ username, bio: bio || null } as unknown as never)
    .eq('id', user.id)

  if (error) {
    return { error: 'No se pudo actualizar el perfil' }
  }

  return { success: true }
}
