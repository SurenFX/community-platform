'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Sin permisos')
}

/** Renombra la temporada activa */
export async function renameSeason(seasonId: string, formData: FormData) {
  await requireAdmin()
  const admin = adminClient()
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return { error: 'El nombre es obligatorio.' }

  const { error } = await admin.from('seasons').update({ name }).eq('id', seasonId)
  if (error) return { error: error.message }

  revalidatePath('/admin/seasons')
  revalidatePath('/dashboard/comunidad')
  return { ok: true }
}

/** Guarda el nombre que tendrá la próxima temporada auto-creada */
export async function setNextSeasonName(formData: FormData) {
  await requireAdmin()
  const admin = adminClient()
  const name = (formData.get('next_name') as string | null)?.trim() ?? ''

  await admin.from('platform_config').upsert(
    { key: 'next_season_name', value: name },
    { onConflict: 'key' }
  )

  revalidatePath('/admin/seasons')
  return { ok: true }
}

/** Cierra la temporada activa ahora mismo (sin crear la siguiente) */
export async function closeSeason(seasonId: string) {
  await requireAdmin()
  const admin = adminClient()

  const { error } = await admin.from('seasons').update({ status: 'CLOSED' }).eq('id', seasonId)
  if (error) return { error: error.message }

  revalidatePath('/admin/seasons')
  revalidatePath('/dashboard/comunidad')
  return { ok: true }
}

/** Cierra la temporada activa Y crea la siguiente inmediatamente */
export async function closeAndRotate(seasonId: string) {
  await requireAdmin()
  const admin = adminClient()

 