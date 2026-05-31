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

// ── XP Manual ──────────────────────────────────────────────────────────────
export async function grantXp(
  targetUserId: string,
  amount: number,
  reason?: string,
): Promise<{ error?: string }> {
  if (amount <= 0 || amount > 10000) return { error: 'Cantidad inválida (1-10000)' }

  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  // Obtener discord_id del usuario para el worker
  const { data: profile } = await admin
    .from('profiles')
    .select('discord_id, discord_tag')
    .eq('id', targetUserId)
    .single()

  if (!profile) return { error: 'Usuario no encontrado' }

  // Llamar al RPC award_xp directamente (mismo que usa el worker)
  const { error: rpcError } = await admin.rpc('award_xp', {
    p_user_id:    targetUserId,
    p_event_type: 'ADMIN_MANUAL_GRANT',
    p_platform:   'DISCORD',
    p_xp:         amount,
    p_base_xp:    amount,
    p_multiplier: 1,
    p_quality:    1,
    p_streak:     0,
    p_ref:        reason ? `admin_grant_${Date.now()}` : null,
    p_metadata:   reason ? { reason } : null,
  })

  if (rpcError) {
    console.error('grantXp error:', rpcError.message)
    return { error: 'No se pudo otorgar el XP' }
  }

  return {}
}
