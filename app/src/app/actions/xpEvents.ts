'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!(profile as any)?.is_admin) throw new Error('Sin permisos')
  return user
}

export async function createXpEvent(formData: FormData) {
  await assertAdmin()
  const title       = formData.get('title') as string
  const description = formData.get('description') as string | null
  const multiplier  = parseFloat(formData.get('multiplier') as string)
  const starts_at   = formData.get('starts_at') as string
  const ends_at     = formData.get('ends_at') as string

  const { error } = await admin()
    .from('global_xp_events')
    .insert({ title, description: description || null, multiplier, starts_at, ends_at })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/xp-events')
  revalidatePath('/dashboard')
}

export async function deleteXpEvent(id: string) {
  await assertAdmin()
  await admin().from('global_xp_events').delete().eq('id', id)
  revalidatePath('/admin/xp-events')
  revalidatePath('/dashboard')
}
