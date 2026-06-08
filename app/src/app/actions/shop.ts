'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Daily Bonus ────────────────────────────────────────────────────────────────
export async function claimDailyBonus(): Promise<{
  error?: string
  xp?: number
  sc?: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const db = adminDb()

  const now       = new Date().toISOString()
  const todayUTC  = now.slice(0, 10) // "YYYY-MM-DD"

  const { data: rep } = await db
    .from('user_reputation')
    .select('total_xp, weekly_xp, monthly_xp, salchi_coins, current_streak, longest_streak, last_daily_bonus_at')
    .eq('user_id', user.id)
    .single()

  const lastBonus    = (rep as any)?.last_daily_bonus_at as string | null
  const lastBonusDay = lastBonus ? lastBonus.slice(0, 10) : null

  // Bloquear si ya reclamó hoy (día calendario UTC)
  if (lastBonusDay === todayUTC) return { error: 'Ya reclamaste el bonus de hoy' }

  const streak        = (rep as any)?.current_streak  ?? 0
  const longestStreak = (rep as any)?.longest_streak  ?? 0

  // La racha continúa solo si el último reclamo fue ayer; si saltó un día, se resetea
  const yesterdayUTC = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const newStreak = lastBonusDay === yesterdayUTC ? streak + 1 : 1

  let xp = 25
  let sc = 1
  if (streak >= 30) { xp = 200; sc = 10 }
  else if (streak >= 7) { xp = 100; sc = 5 }
  else if (streak >= 3) { xp = 50;  sc = 2  }

  const currentCoins = (rep as any)?.salchi_coins ?? 0

  const newTotalXp = ((rep as any)?.total_xp   ?? 0) + xp
  const newLevel   = Math.min(Math.floor((-9 + Math.sqrt(121 + newTotalXp / 3.125)) / 2), 200)

  // Actualizar todo en un solo UPDATE
  await db.from('user_reputation').update({
    total_xp:            newTotalXp,
    weekly_xp:           ((rep as any)?.weekly_xp  ?? 0) + xp,
    monthly_xp:          ((rep as any)?.monthly_xp ?? 0) + xp,
    level:               newLevel,
    salchi_coins:        currentCoins + sc,
    current_streak:      newStreak,
    longest_streak:      Math.max(longestStreak, newStreak),
    last_daily_bonus_at: now,
  }).eq('user_id', user.id)

  // Insertar xp_event para historial de actividad
  await db.from('xp_events').insert({
    user_id:       user.id,
    event_type:    'STREAK_BONUS',
    xp_awarded:    xp,
    base_xp:       xp,
    multiplier:    1,
    quality_score: 1,
    streak_bonus:  0,
    platform:      'DISCORD',
    metadata:      { source: 'DAILY_BONUS', streak: newStreak },
  })

  // Notificación para que aparezca en historial de coins
  await db.from('notifications').insert({
    user_id: user.id,
    type:    'STREAK_BONUS',
    title:   `+${sc} SalchiCoins — Bono diario`,
    body:    `Racha de ${newStreak} día${newStreak !== 1 ? 's' : ''}. También ganaste ${xp} XP.`,
    is_read: false,
  })

  return { xp, sc }
}

// ── Shop: comprar item ─────────────────────────────────────────────────────────
export async function purchaseItem(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const db = adminDb()

  const { data: item } = await db
    .from('shop_items')
    .select('id, price_sc, is_available, boost_type, boost_value, boost_duration_hours')
    .eq('id', itemId)
    .single()

  if (!item || !(item as any).is_available) return { error: 'Item no disponible' }

  const isBoost = !!(item as any).boost_type

  // Cosmeticos: verificar que no lo tenga ya
  if (!isBoost) {
    const { data: owned } = await db
      .from('user_inventory')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .maybeSingle()
    if (owned) return { error: 'Ya tenés este item' }
  }

  // Deducción atómica via RPC (evita race condition de balance negativo)
  const { error: rpcError } = await db.rpc('deduct_sc_if_enough', {
    p_user_id: user.id,
    p_amount:  (item as any).price_sc,
  })
  if (rpcError) return { error: 'SC insuficientes' }

  if (isBoost) {
    // Boost consumible: insertar en active_boosts con tiempo de expiración
    const hours      = (item as any).boost_duration_hours ?? 1
    const expiresAt  = new Date(Date.now() + hours * 3600 * 1000).toISOString()
    await db.from('active_boosts').insert({
      user_id:     user.id,
      boost_type:  (item as any).boost_type,
      boost_value: (item as any).boost_value,
      expires_at:  expiresAt,
    })
  } else {
    await db.from('user_inventory').insert({ user_id: user.id, item_id: itemId })
  }

  revalidatePath('/dashboard', 'layout')
  return {}
}

// ── Shop: equipar / desequipar ─────────────────────────────────────────────────
const EQUIP_COLUMN: Record<string, string> = {
  BORDER_COLOR:  'equipped_border_color',
  NAME_EMOJI:    'equipped_name_emoji',
  CUSTOM_TITLE:  'equipped_title_override',
}

export async function equipItem(
  itemId: string,
  type: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const col = EQUIP_COLUMN[type]
  if (!col) return { error: 'Tipo inválido' }

  const db = adminDb()

  // Verificar que tenga el item
  const { data: item } = await db
    .from('shop_items')
    .select('value')
    .eq('id', itemId)
    .single()
  if (!item) return { error: 'Item no existe' }

  const { data: owned } = await db
    .from('user_inventory')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .maybeSingle()
  if (!owned) return { error: 'No tenés este item' }

  await db.from('profiles').update({ [col]: (item as any).value }).eq('id', user.id)
  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function unequipItem(type: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const col = EQUIP_COLUMN[type]
  if (!col) return { error: 'Tipo inválido' }

  const db = adminDb()
  await db.from('profiles').update({ [col]: null }).eq('id', user.id)
  revalidatePath('/dashboard', 'layout')
  return {}
}

// ── Rueda de la suerte ─────────────────────────────────────────────────────────
const SPIN_COST = 20

export async function spinWheel(): Promise<{
  error?: string
  prize?: { name: string; description: string; prize_type: string; prize_value: number; rarity: string; emoji: string; segmentIndex: number }
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const db = adminDb()

  // Deducir SC
  const { error: rpcError } = await db.rpc('deduct_sc_if_enough', {
    p_user_id: user.id,
    p_amount:  SPIN_COST,
  })
  if (rpcError) return { error: 'SC insuficientes (necesitas 20 SC)' }

  // Cargar premios
  const { data: prizes } = await db
    .from('spin_wheel_prizes')
    .select('*')
    .order('sort_order')

  if (!prizes || prizes.length === 0) return { error: 'No hay premios configurados' }

  // Selección aleatoria ponderada
  const totalWeight = (prizes as any[]).reduce((s: number, p: any) => s + p.weight, 0)
  let rand = Math.random() * totalWeight
  let winner: any = prizes[prizes.length - 1]
  let segmentIndex = prizes.length - 1
  for (let i = 0; i < prizes.length; i++) {
    rand -= (prizes as any[])[i].weight
    if (rand <= 0) { winner = prizes[i]; segmentIndex = i; break }
  }

  // Entregar premio
  if (winner.prize_type === 'sc' && winner.prize_value > 0) {
    const { data: rep } = await db.from('user_reputation').select('salchi_coins').eq('user_id', user.id).single()
    await db.from('user_reputation').update({ salchi_coins: ((rep as any)?.salchi_coins ?? 0) + winner.prize_value }).eq('user_id', user.id)
  } else if (winner.prize_type === 'xp' && winner.prize_value > 0) {
    const { data: rep } = await db.from('user_reputation').select('total_xp, weekly_xp, monthly_xp').eq('user_id', user.id).single()
    const newTotal = ((rep as any)?.total_xp ?? 0) + winner.prize_value
    const newLevel = Math.min(Math.floor((-9 + Math.sqrt(121 + newTotal / 3.125)) / 2), 200)
    await db.from('user_reputation').update({
      total_xp:   newTotal,
      weekly_xp:  ((rep as any)?.weekly_xp  ?? 0) + winner.prize_value,
      monthly_xp: ((rep as any)?.monthly_xp ?? 0) + winner.prize_value,
      level:      newLevel,
    }).eq('user_id', user.id)
    await db.from('xp_events').insert({
      user_id: user.id, event_type: 'WHEEL_SPIN', xp_awarded: winner.prize_value,
      base_xp: winner.prize_value, multiplier: 1, quality_score: 1, streak_bonus: 0,
      platform: 'DISCORD', metadata: { source: 'SPIN_WHEEL', prize: winner.name },
    })
  }

  // Registrar historial
  await db.from('spin_wheel_history').insert({
    user_id:        user.id,
    prize_id:       winner.id,
    prize_snapshot: winner,
    cost_sc:        SPIN_COST,
  })

  revalidatePath('/dashboard', 'layout')

  return {
    prize: {
      name:         winner.name,
      description:  winner.description,
      prize_type:   winner.prize_type,
      prize_value:  winner.prize_value,
      rarity:       winner.rarity,
      emoji:        winner.emoji,
      segmentIndex,
    }
  }
}

export { SPIN_COST }

// ── Prestige ───────────────────────────────────────────────────────────────────
export const PRESTIGE_LEVEL = 200

export async function prestigeUser(): Promise<{ error?: string; newPrestige?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const db = adminDb()

  const { data: rep } = await db
    .from('user_reputation')
    .select('total_xp, level, prestige_level, salchi_coins')
    .eq('user_id', user.id)
    .single()

  if (!rep) return { error: 'Perfil no encontrado' }
  if ((rep as any).level < PRESTIGE_LEVEL) return { error: `Necesitas nivel ${PRESTIGE_LEVEL} para hacer Prestige` }

  const currentPrestige = (rep as any).prestige_level ?? 0
  const newPrestige     = currentPrestige + 1
  const bonusSc         = 500 * newPrestige  // 500 SC por cada nivel de prestige

  // Guardar historial
  await db.from('prestige_history').insert({
    user_id:        user.id,
    prestige_level: newPrestige,
    reset_xp:       (rep as any).total_xp,
    reset_level:    (rep as any).level,
    bonus_sc:       bonusSc,
  })

  // Resetear XP y nivel, incrementar prestige, dar SC de bonus
  await db.from('user_reputation').update({
    total_xp:       0,
    weekly_xp:      0,
    monthly_xp:     0,
    level:          1,
    prestige_level: newPrestige,
    salchi_coins:   ((rep as any).salchi_coins ?? 0) + bonusSc,
  }).eq('user_id', user.id)

  // Notificación
  await db.from('notifications').insert({
    user_id: user.id,
    type:    'PRESTIGE',
    title:   `Prestige ${newPrestige} alcanzado!`,
    body:    `Reseteaste al nivel 1 con Prestige ${newPrestige}. Recibiste ${bonusSc} SC de bonus.`,
    is_read: false,
  })

  revalidatePath('/dashboard', 'layout')
  return { newPrestige }
}
