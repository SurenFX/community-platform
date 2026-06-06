import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import BadgesClient from './BadgesClient'

export default async function AdminBadgesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: badges }, { data: earnedRows }, { data: users }] = await Promise.all([
    admin
      .from('badges')
      .select('id, slug, name, description, image_url, tier, family, family_order, is_secret')
      .not('family', 'is', null)
      .order('family')
      .order('family_order'),
    admin.from('user_badges').select('badge_id, user_id'),
    admin.from('profiles').select('id, username, avatar_url').order('username'),
  ])

  // Conteo por badge
  const countMap: Record<string, number> = {}
  for (const ub of earnedRows ?? []) {
    countMap[ub.badge_id] = (countMap[ub.badge_id] ?? 0) + 1
  }

  // Set de user_id por badge para saber quién lo tiene
  const earnedByBadge: Record<string, Set<string>> = {}
  for (const ub of earnedRows ?? []) {
    if (!earnedByBadge[ub.badge_id]) earnedByBadge[ub.badge_id] = new Set()
    earnedByBadge[ub.badge_id].add(ub.user_id)
  }

  const badgesWithMeta = (badges ?? []).map(b => ({
    ...b,
    earned_count: countMap[b.id] ?? 0,
    earned_user_ids: [...(earnedByBadge[b.id] ?? [])],
  }))

  return (
    <BadgesClient
      badges={badgesWithMeta}
      users={users ?? []}
    />
  )
}
