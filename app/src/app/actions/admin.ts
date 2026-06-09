'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
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

// ── Raffles ────────────────────────────────────────────────────────────────
interface RaffleInput {
  title:         string
  description:   string
  prize:         string
  use_weighted:  boolean
  min_level:     number | null
  min_xp:        number | null
  starts_at:     string
  ends_at:       string
}

export async function createRaffle(data: RaffleInput): Promise<{ id?: string; error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { data: raffle, error } = await admin
    .from('raffles')
    .insert({ ...data, status: 'ACTIVE', required_platforms: [] })
    .select('id')
    .single()

  if (error) return { error: 'No se pudo crear el sorteo' }
  return { id: (raffle as any).id }
}

export async function drawRaffle(raffleId: string): Promise<{ winner?: string; error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  // Obtener todos los participantes con sus tickets
  const { data: pool } = await admin
    .from('raffle_pools')
    .select('user_id, tickets')
    .eq('raffle_id', raffleId)

  if (!pool?.length) return { error: 'No hay participantes' }

  // Obtener configuración del sorteo
  const { data: raffle } = await admin
    .from('raffles')
    .select('use_weighted')
    .eq('id', raffleId)
    .single()

  let winnerId: string

  if ((raffle as any)?.use_weighted) {
    // Sorteo ponderado: cada ticket es una entrada
    const entries: string[] = []
    for (const p of pool as any[]) {
      for (let i = 0; i < (p.tickets || 1); i++) entries.push(p.user_id)
    }
    winnerId = entries[Math.floor(Math.random() * entries.length)]
  } else {
    // Sorteo igual: un voto por participante
    const p = (pool as any[])[Math.floor(Math.random() * pool.length)]
    winnerId = p.user_id
  }

  await admin.from('raffles').update({
    status:    'DRAWN',
    winner_id: winnerId,
    drawn_at:  new Date().toISOString(),
  }).eq('id', raffleId)

  // Obtener username del ganador
  const { data: winner } = await admin
    .from('profiles').select('username').eq('id', winnerId).single()

  return { winner: (winner as any)?.username ?? winnerId }
}

export async function cancelRaffle(raffleId: string): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { error } = await admin
    .from('raffles').update({ status: 'CANCELLED' }).eq('id', raffleId)

  if (error) return { error: 'No se pudo cancelar' }
  return {}
}

export async function deleteRaffle(raffleId: string): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  // Borrar pool primero (FK constraint)
  await admin.from('raffle_pools').delete().eq('raffle_id', raffleId)
  const { error } = await admin.from('raffles').delete().eq('id', raffleId)

  if (error) return { error: 'No se pudo borrar' }
  return {}
}

// ── Badges ─────────────────────────────────────────────────────────────────
export async function grantBadge(badgeId: string, targetUserId: string): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { error } = await admin
    .from('user_badges')
    .upsert(
      { badge_id: badgeId, user_id: targetUserId, earned_at: new Date().toISOString() },
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
    )

  if (error) return { error: 'No se pudo otorgar el badge' }
  return {}
}

export async function revokeBadge(badgeId: string, targetUserId: string): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { error } = await admin
    .from('user_badges')
    .delete()
    .eq('badge_id', badgeId)
    .eq('user_id', targetUserId)

  if (error) return { error: 'No se pudo revocar el badge' }
  return {}
}

// ── SC Manual ──────────────────────────────────────────────────────────────
export async function grantSc(
  targetUserId: string,
  amount: number,
  reason?: string,
): Promise<{ error?: string }> {
  if (amount <= 0 || amount > 100000) return { error: 'Cantidad inválida (1-100000)' }

  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  const { data: rep } = await admin
    .from('user_reputation')
    .select('salchi_coins')
    .eq('user_id', targetUserId)
    .single()

  if (!rep) return { error: 'Usuario no encontrado' }

  const { error } = await admin
    .from('user_reputation')
    .update({ salchi_coins: (rep as any).salchi_coins + amount })
    .eq('user_id', targetUserId)

  if (error) return { error: 'No se pudo otorgar los SC' }

  await admin.from('notifications').insert({
    user_id: targetUserId,
    type:    'SYSTEM',
    title:   `+${amount} SalchiCoins`,
    message: reason ? `El equipo te otorgó SC: ${reason}` : 'El equipo te otorgó SalchiCoins.',
    is_read: false,
  })

  return {}
}

// ── User reset ─────────────────────────────────────────────────────────────
export async function resetUserProgress(targetUserId: string): Promise<{ error?: string }> {
  const { error: authError, admin } = await getAdminClient()
  if (authError || !admin) return { error: authError ?? 'Error' }

  // Resetear reputación (XP, nivel, racha, tickets)
  await admin
    .from('user_reputation')
    .update({
      total_xp:            0,
      weekly_xp:           0,
      monthly_xp:          0,
      level:               1,
      current_streak:      0,
      longest_streak:      0,
      raffle_tickets:      0,
      salchi_coins:        0,
      last_active_date:    null,
      last_daily_bonus_at: null,
    })
    .eq('user_id', targetUserId)

  // Borrar badges
  await admin.from('user_badges').delete().eq('user_id', targetUserId)

  // Borrar progreso de misiones
  await admin.from('user_missions').delete().eq('user_id', targetUserId)

  // Borrar historial de XP
  await admin.from('xp_events').delete().eq('user_id', targetUserId)

  // Borrar reclamos del pase de temporada
  await admin.from('season_pass_claims').delete().eq('user_id', targetUserId)

  // Borrar cookie de bonus diario del browser actual (por si el admin se resetea a si mismo)
  const cookieStore = await cookies()
  cookieStore.delete('daily_bonus_claimed')

  return {}
}

// ── Boss Raids ─────────────────────────────────────────────────────────────────
export async function createBossRaid(data: {
  name: string; emoji: string; lore: string
  max_hp: number; reward_xp: number; reward_sc: number; duration_hours: number
}): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const adminDb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: profile } = await adminDb.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!(profile as any)?.is_admin) return { error: 'Sin permisos' }

  const endsAt = new Date(Date.now() + data.duration_hours * 3600 * 1000).toISOString()

  const { error } = await adminDb.from('boss_raids').insert({
    name:       data.name,
    emoji:      data.emoji || '👹',
    lore:       data.lore || null,
    max_hp:     data.max_hp,
    current_hp: data.max_hp,
    reward_xp:  data.reward_xp,
    reward_sc:  data.reward_sc,
    status:     'ACTIVE',
    phase:      1,
    starts_at:  new Date().toISOString(),
    ends_at:    endsAt,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/challenges')
  revalidatePath('/admin/boss-raids')
  return {}
}

// ── Rueda de la suerte — premios ──────────────────────────────────────────────
export async function createWheelPrize(data: {
  name:        string
  description: string
  prize_type:  string
  prize_value: number
  rarity:      string
  weight:      number
  color:       string
  emoji:       string
  sort_order:  number
}): Promise<{ error?: string }> {
  'use server'
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const adminDb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: profile } = await adminDb.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!(profile as any)?.is_admin) return { error: 'Sin permisos' }

  const { error } = await adminDb.from('spin_wheel_prizes').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin/rueda')
  revalidatePath('/dashboard/rueda')
  return {}
}

export async function updateWheelPrize(id: string, data: {
  name:        string
  description: string
  prize_type:  string
  prize_value: number
  rarity:      string
  weight:      number
  color:       string
  emoji:       string
  sort_order:  number
}): Promise<{ error?: string }> {
  'use server'
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const adminDb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: profile } = await adminDb.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!(profile as any)?.is_admin) return { error: 'Sin permisos' }

  const { error } = await adminDb.from('spin_wheel_prizes').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/rueda')
  revalidatePath('/dashboard/rueda')
  return {}
}

export async function deleteWheelPrize(id: string): Promise<{ error?: string }> {
  'use server'
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const adminDb = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: profile } = await adminDb.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!(profile as any)?.is_admin) return { error: 'Sin permisos' }

  const { error } = await adminDb.from('spin_wheel_prizes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/rueda')
  revalidatePath('/dashboard/rueda')
  return {}
}
