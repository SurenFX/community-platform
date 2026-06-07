'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Aceptar una misión (crear user_mission row) ─────────────────────────────
export async function acceptMission(missionId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = getAdmin()

  // Verificar que la misión existe y está activa
  const now = new Date().toISOString()
  const { data: mission } = await admin
    .from('missions')
    .select('id')
    .eq('id', missionId)
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .single()

  if (!mission) return { error: 'Misión no disponible' }

  // INSERT atómico: el UNIQUE constraint (user_id, mission_id) previene el doble-accept.
  // Si ya existe la fila, Supabase devuelve error con code 23505 (unique_violation).
  const { error } = await admin
    .from('user_missions')
    .insert({ user_id: user.id, mission_id: missionId, progress: 0 })

  if (error) {
    if ((error as any).code === '23505') return { error: 'Ya aceptaste esta misión' }
    return { error: 'No se pudo aceptar la misión' }
  }
  return {}
}

// ── Reclamar recompensa de misión completada ────────────────────────────────
export async function claimMission(userMissionId: string): Promise<{ error?: string; xpReward?: number; coinReward?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = getAdmin()

  // Primero leer los datos de la misión (sin cambiar nada todavía)
  const { data: um } = await admin
    .from('user_missions')
    .select('id, is_completed, is_claimed, missions!inner(id, xp_reward, coin_reward, title)')
    .eq('id', userMissionId)
    .eq('user_id', user.id)
    .single()

  if (!um) return { error: 'Misión no encontrada' }
  if (!(um as any).is_completed) return { error: 'La misión no está completada aún' }
  if ((um as any).is_claimed)    return { error: 'Ya reclamaste esta recompensa' }

  const mission = (um as any).missions

  // UPDATE atómico: solo actualiza si is_claimed sigue siendo false
  // Esto previene el double-claim por race condition (dos tabs simultáneos)
  const { count } = await admin
    .from('user_missions')
    .update({ is_claimed: true })
    .eq('id', userMissionId)
    .eq('user_id', user.id)
    .eq('is_claimed', false)
    .select('id', { count: 'exact', head: true })

  if (!count || count === 0) return { error: 'Ya reclamaste esta recompensa' }

  // Otorgar XP
  if (mission.xp_reward > 0) {
    await admin.rpc('award_xp', {
      p_user_id:    user.id,
      p_event_type: 'MISSION_COMPLETED',
      p_platform:   'DISCORD',
      p_xp:         mission.xp_reward,
      p_base_xp:    mission.xp_reward,
      p_multiplier: 1.0,
      p_quality:    1.0,
      p_streak:     0,
      p_ref:        mission.id,
      p_metadata:   { mission_id: mission.id },
    })
  }

  // Otorgar SC
  if ((mission.coin_reward ?? 0) > 0) {
    const { data: rep } = await admin
      .from('user_reputation')
      .select('salchi_coins')
      .eq('user_id', user.id)
      .single()

    const current = (rep as any)?.salchi_coins ?? 0
    await admin
      .from('user_reputation')
      .update({ salchi_coins: current + mission.coin_reward })
      .eq('user_id', user.id)
  }

  return { xpReward: mission.xp_reward, coinReward: mission.coin_reward ?? 0 }
}
