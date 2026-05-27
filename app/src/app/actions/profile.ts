'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado' }

  const username = formData.get('username') as string
  const bio      = formData.get('bio') as string

  // Validaciones
  if (!username || username.length < 3 || username.length > 20) {
    return { error: 'El username debe tener entre 3 y 20 caracteres' }
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: 'El username solo puede contener letras, números y guiones bajos' }
  }

  // Verificar que el username no esté tomado por otro usuario
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .single()

  if (existing) return { error: 'Ese username ya está en uso' }

  const { error } = await supabase
    .from('profiles')
    .update({ username, bio: bio || null })
    .eq('id', user.id)

  if (error) return { error: 'Error al actualizar el perfil' }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/profile/${user.id}`)
  return { success: true }
}
