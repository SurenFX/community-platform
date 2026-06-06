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

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Sin permisos')
  return user
}

export async function createChallenge(formData: FormData) {
  await requireAdmin()
  const admin = adminClient()

  const title           = (formData.get('title') as string | null)?.trim()
  const description     = (formData.get('description') as string | null)?.trim() || null
  const goal_xp         = parseInt(formData.get('goal_xp') as string ?? '0', 10)
  const reward_xp       = parseInt(formData.get('reward_xp') as string ?? '0', 10)
  const reward_sc       = parseInt(formData.get('reward_sc') as string ?? '0', 10)
  const durationDays    = parseInt(formData.get('duration_days') as string ?? '7', 10)

  if (!title) return { error: 'El título es obligatorio.' }
  if (!goal_xp || goal_xp < 1) return { error: 'El objetivo de XP debe ser mayor que 0.' }

  const now    = new Date()
  const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await admin.from('community_challenges').insert({
    title,
    description,
    goal_xp,
    reward_xp_per_user: reward_xp,
    reward_sc_per_user: reward_sc,
    status:    'ACTIVE',
    starts_at: now.toISOString(),
    ends_at:   endsAt,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/challenges')
  revalidatePath('/dashboard/challenges')
  return { ok: true }
}

export async function updateChallengeStatus(challengeId: string, status: 'COMPLETED' | 'FAILED') {
  await requireAdmin()
  const admin = adminClient()

  const { error } = await admin
    .from('community_challenges')
    .update({ status })
    .eq('id', challengeId)

  if (error) return { error: error.message }

  revalidatePath('/admin/challenges')
  revalidatePath('/dashboard/challenges')
  return { ok: true }
}
