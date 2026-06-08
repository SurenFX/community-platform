import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ShopClient from './ShopClient'

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [itemsRes, inventoryRes, repRes, profileRes] = await Promise.all([
    admin.from('shop_items').select('*').eq('is_available', true).order('sort_order'),
    admin.from('user_inventory').select('item_id').eq('user_id', user.id),
    admin.from('user_reputation').select('salchi_coins').eq('user_id', user.id).single(),
    admin.from('profiles')
      .select('username, avatar_url, equipped_border_color, equipped_name_emoji, equipped_title_override')
      .eq('id', user.id)
      .single(),
  ])

  const inventoryIds = (inventoryRes.data ?? []).map((i: any) => i.item_id as string)
  const balance      = (repRes.data as any)?.salchi_coins ?? 0
  const profile      = profileRes.data as any

  return (
    <ShopClient
      items={(itemsRes.data ?? []) as any}
      balance={balance}
      inventoryIds={inventoryIds}
      equippedBorder={profile?.equipped_border_color ?? null}
      equippedEmoji={profile?.equipped_name_emoji ?? null}
      equippedTitle={profile?.equipped_title_override