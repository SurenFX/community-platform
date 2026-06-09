'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

import { SEASON_MILESTONES } from '@/lib/seasonMilestones'

export async function claimSeasonMilestone(seasonId: string, milestoneXp: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = adminClient()

  // Verify milestone exists
  const milestone = SEASON_MILESTONES.find(m => m.xp === milestoneXp)
  if (!milestone) return { error: 'Hito invalido' }

  // Check user has enough season XP
  const { data: season } = await admin
    .from('seasons').select('starts_at').eq('id', seasonId).single()
  if (!season) return { error: 'Temporada no encontrada' }

  const { data: xpRows } = await admin
    .from('xp_events')
    .select('xp_awarded')
    .eq('user_id', user.id)
    .gte('created_at', season.starts_at)

  const seasonXp = (xpRows ?? []).reduce((s: number, r: any) => s + (r.xp_awarded ?? 0), 0)
  if (seasonXp < milestoneXp) return { error: 'No alcanzaste este hito aun' }

  // Insert claim (UNIQUE constraint prevents double-claim)
  const { error: claimErr } = await admin
    .from('season_pass_claims')
    .insert({ user_id: user.id, season_id: seasonId, milestone_xp: milestoneXp })

  if (claimErr) {
    if (claimErr.code === '23505') return { error: 'Ya reclamaste este hito' }
    return { error: claimErr.message }
  }

  // Give SC reward if applicable
  if (milestone.type === 'sc' && milestone.amount > 0) {
    const { data: rep } = await admin
      .from('user_reputation').select('salchi_coins').eq('user_id', user.id).single()
    await admin.from('user_reputation')
      .update({ salchi_coins: ((rep as any)?.salchi_coins ?? 0) + milestone.amount })
      .eq('user_id', user.id)
    await admin.from('notifications').insert({
      user_id: user.id,
      type: 'SEASON_MILESTONE',
      title: 'Hito de temporada reclamado',
      message: `Ganaste ${milestone.reward} por llegar a ${milestoneXp.toLocaleString('es-AR')} XP de temporada.`,
    })
  }

  revalidatePath('/dashboard')
  return { ok: true, reward: milestone.reward }
}
