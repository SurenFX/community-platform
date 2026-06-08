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
  const supabase = await creat