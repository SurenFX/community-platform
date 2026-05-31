'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Mission, MissionType, XpEventType } from '@/types/database'

// ── Helper ─────────────────────────────────────────────────────────────────
async function getAdminClient() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', admin: null }

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!profile?.is_admin) return { error: 'Sin permisos', admin: null }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  return { error: null, admin }
}

// ── XP Config ──────────────────────────────────────────────────────────────
export async function updateXpConfig(
  id: string,
  fields: { base_xp: number; cooldown_sec: number; daily_cap: number; is_enabled: boolean }
): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { error } = await admin
    .from('xp_config')
    .update(fields)
    .eq('id', id)

  if (error) {
    console.error('updateXpConfig error:', error.message)
    return { error: 'No se pudo guardar la configuración' }
  }
  return {}
}

// ── Missions ───────────────────────────────────────────────────────────────
interface MissionInput {
  title:          string
  description:    string
  type:           MissionType
  objective_type: XpEventType
  target_count:   number
  xp_reward:      number
  ticket_reward:  number
  starts_at:      string
  ends_at:        string
  required_platforms: string[]
}

export async function createMission(data: MissionInput): Promise<{ data?: Mission; error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { data: created, error } = await admin
    .from('missions')
    .insert({ ...data, is_active: true })
    .select()
    .single()

  if (error) {
    console.error('createMission error:', error.message)
    return { error: 'No se pudo crear la misión' }
  }
  return { data: created as Mission }
}

export async function updateMission(id: string, data: MissionInput): Promise<{ data?: Mission; error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { data: updated, error } = await admin
    .from('missions')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateMission error:', error.message)
    return { error: 'No se pudo actualizar la misión' }
  }
  return { data: updated as Mission }
}

export async function toggleMissionActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { error } = await admin
    .from('missions')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    console.error('toggleMissionActive error:', error.message)
    return { error: 'No se pudo cambiar el estado' }
  }
  return {}
}
