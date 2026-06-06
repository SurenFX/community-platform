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

  // Cerrar la actual
  const { error } = await admin.from('seasons').update({ status: 'CLOSED' }).eq('id', seasonId)
  if (error) return { error: error.message }

  // Llamar a la misma lógica que el cron: calcular nombre y crear la siguiente
  const { data: seasons } = await admin.from('seasons').select('name')
  const lastNum = (seasons ?? []).reduce((max: number, s: any) => {
    const m = s.name?.match(/Temporada (\d+)/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  const { data: config } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', 'next_season_name')
    .maybeSingle()

  const nextName = config?.value?.trim() || `Temporada ${lastNum + 1}`

  const now = new Date()
  const endsAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, 0, 0, 0
  )).toISOString()

  const { error: createErr } = await admin.from('seasons').insert({
    name:      nextName,
    status:    'ACTIVE',
    starts_at: now.toISOString(),
    ends_at:   endsAt,
  })
  if (createErr) return { error: createErr.message }

  // Limpiar nombre personalizado
  await admin.from('platform_config').delete().eq('key', 'next_season_name')

  revalidatePath('/admin/seasons')
  revalidatePath('/dashboard/comunidad')
  return { ok: true }
}

/** Crea una temporada manualmente (para el primer setup o casos especiales) */
export async function createSeason(formData: FormData) {
  await requireAdmin()
  const admin = adminClient()

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return { error: 'El nombre es obligatorio.' }

  // Cerrar cualquier activa
  await admin.from('seasons').update({ status: 'CLOSED' }).eq('status', 'ACTIVE')

  const now = new Date()
  const endsAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, 0, 0, 0
  )).toISOString()

  const { error } = await admin.from('seasons').insert({
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
