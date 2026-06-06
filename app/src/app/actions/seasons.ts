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
  return user
}

/**
 * Crea una nueva temporada. Siempre cierra a las 00:00 UTC del 1º del próximo mes.
 */
export async function createSeason(formData: FormData) {
  await requireAdmin()
  const admin = adminClient()

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return { error: 'El nombre es obligatorio.' }

  // Cierra siempre a las 00:00 UTC del 1º del mes siguiente
  const now   = new Date()
  const year  = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed
  const endsAt = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0)).toISOString()

  // Hay que cerrar cualquier otra temporada activa
  const { error: closeErr } = await admin
    .from('seasons')
    .update({ status: 'CLOSED' })
    .eq('status', 'ACTIVE')

  if (closeErr) return { error: closeErr.message }

  const { error } = await admin
    .from('seasons')
    .insert({
      name,
      status:    'ACTIVE',
      starts_at: now.toISOString(),
      ends_at:   endsAt,
    })

  if (error) return { error: error.message }

  revalidatePath('/admin/seasons')
  revalidatePath('/dashboard/comunidad')
  return { ok: true }
}

/**
 * Cierra manualmente la temporada activa.
 */
export async function closeSeason(seasonId: string) {
  await requireAdmin()
  const admin = adminClient()

  const { error } = await admin
    .from('seasons')
    .update({ status: 'CLOSED' })
    .eq('id', seasonId)

  if (error) return { error: error.message }

  revalidatePath('/admin/seasons')
  revalidatePath('/dashboard/comunidad')
  return { ok: true }
}
