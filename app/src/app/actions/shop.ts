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

  // Claim atómico: solo actualiza si no reclamó en las últimas 23h
  const now = new Date().toISOString()
  const cutoff = new Date(Date.now() - 23 * 3_600_000).toISOString()

  const { data: rep } = await db
    .from('user_reputation')
    .select('salchi_coins, current_streak, longest_streak, last_daily_bonus_at')
    .eq('user_id', user.id)
    .single()

  const lastBonus = (rep as any)?.last_daily_bonus_at
  if (lastBonus && lastBonus > cutoff) return { error: 'Ya reclamaste el bonus de hoy' }

  const streak        = (rep as any)?.current_streak  ?? 0
  const longestStreak = (rep as any)?.longest_streak  ?? 0
  const newStreak     = streak + 1

  let xp = 25
  let sc = 1
  if (streak >= 30) { xp = 200; sc = 10 }
  else if (streak >= 7) { xp = 100; sc = 5 }
  else if (streak >= 3) { xp = 50;  sc = 2  }

  const currentCoins = (rep as any)?.salchi_coins ?? 0

  // Usar award_xp RPC para que actualice nivel y dispare level-up
  const { error: rpcError } = await db.rpc('award_xp', {
    p_user_id:    user.id,
    p_event_type: 'STREAK_BONUS',
    p_platform:   'SYSTEM',
    p_xp:         xp,
    p_base_xp:    xp,
    p_multiplier: 1,
    p_quality:    1,
    p_streak:     0,
    p_ref:        `daily_bonus_${now}`,
    p_metadata:   { source: 'DAILY_BONUS', streak: newStreak },
  })

  if (rpcError) {
    console.error('claimDailyBonus award_xp error:', rpcError.message)
    return { error: 'Error al reclamar el bonus' }
  }

  // Actualizar streak, SC y timestamp
  await db.from('user_reputation').update({
    salchi_coins:        currentCoins + sc,
    current_streak:      newStreak,
    longest_streak:      Math.max(longestStreak, newStreak),
    last_daily_bonus_at: now,
  }).eq('user_id', user.id)

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
    .select('id, price_sc, is_available')
    .eq('id', itemId)
    .single()

  if (!item || !(item as any).is_available) return { error: 'Item no disponible' }

  const { data: owned } = await db
    .from('user_inventory')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .maybeSingle()
  if (owned) return { error: 'Ya tenés este item' }

  // Deducción atómica via RPC (evita race condition de balance negativo)
  const { error: rpcError } = await db.rpc('deduct_sc_if_enough', {
    p_user_id: user.id,
    p_amount:  (item as any).price_sc,
  })
  if (rpcError) return { error: 'SC insuficientes' }

  await db.from('user_inventory').insert({ user_id: user.id, item_id: itemId })

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
