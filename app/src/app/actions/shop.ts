'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

  const { data: rep } = await db
    .from('user_reputation')
    .select('total_xp, weekly_xp, monthly_xp, salchi_coins, current_streak, last_daily_bonus_at')
    .eq('user_id', user.id)
    .single()

  const lastBonus = (rep as any)?.last_daily_bonus_at
  if (lastBonus) {
    const hoursSince = (Date.now() - new Date(lastBonus).getTime()) / 3_600_000
    if (hoursSince < 23) return { error: 'Ya reclamaste el bonus de hoy' }
  }

  const streak = (rep as any)?.current_streak ?? 0
  let xp = 25
  let sc = 1
  if (streak >= 30) { xp = 200; sc = 10 }
  else if (streak >= 7) { xp = 100; sc = 5 }
  else if (streak >= 3) { xp = 50;  sc = 2  }

  const currentCoins = (rep as any)?.salchi_coins ?? 0

  await Promise.all([
    db.from('user_reputation').update({
      total_xp:             ((rep as any)?.total_xp   ?? 0) + xp,
      weekly_xp:            ((rep as any)?.weekly_xp  ?? 0) + xp,
      monthly_xp:           ((rep as any)?.monthly_xp ?? 0) + xp,
      salchi_coins:         currentCoins + sc,
      last_daily_bonus_at:  new Date().toISOString(),
    }).eq('user_id', user.id),
    db.from('xp_events').insert({
      user_id:     user.id,
      event_type:  'DAILY_BONUS',
      xp_awarded:  xp,
      platform:    'SYSTEM',
    }),
  ])

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

  const { data: rep } = await db
    .from('user_reputation')
    .select('salchi_coins')
    .eq('user_id', user.id)
    .single()
  const balance = (rep as any)?.salchi_coins ?? 0
  if (balance < (item as any).price_sc) return { error: 'SC insuficientes' }

  await Promise.all([
    db.from('user_reputation')
      .update({ salchi_coins: balance - (item as any).price_sc })
      .eq('user_id', user.id),
    db.from('user_inventory').insert({ user_id: user.id, item_id: itemId }),
  ])

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
  return {}
}
