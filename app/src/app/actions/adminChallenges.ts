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
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!profile?.is_admin) throw new Error('Sin permisos')
  return user
}

export async function createChallenge(formData: FormData) {
  await requireAdmin()
  const admin = adminClient()

  const title        = (formData.get('title') as string | null)?.trim()
  const description  = (formData.get('description') as string | null)?.trim() || null
  const goal_xp      = parseInt(formData.get('goal_xp') as string ?? '0', 10)
  const reward_xp    = parseInt(formData.get('reward_xp') as string ?? '0', 10)
  const reward_sc    = parseInt(formData.get('reward_sc') as string ?? '0', 10)
  if (!title) return { error: 'El titulo es obligatorio.' }
  if (!goal_xp || goal_xp < 1) return { error: 'El objetivo de XP debe ser mayor que 0.' }

  // Siempre empieza ahora y termina el proximo lunes a las 00:00 UTC
  const now = new Date()
  const msUntilMonday = (() => {
    const day = now.getUTCDay() // 0=dom, 1=lun, ...6=sab
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7
    const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday))
    return nextMonday
  })()
  const endsAt = msUntilMonday.toISOString()

  const { error } = await admin.from('community_challenges').insert({
    title, description, goal_xp,
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

  // Obtener el desafío para saber las recompensas
  const { data: challenge } = await admin
    .from('community_challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Desafío no encontrado.' }

  // Actualizar estado
  const { error } = await admin
    .from('community_challenges')
    .update({ status })
    .eq('id', challengeId)

  if (error) return { error: error.message }

  // Si se completó y tiene recompensas, repartir a todos los usuarios activos en el período
  if (status === 'COMPLETED' && (challenge.reward_xp_per_user > 0 || challenge.reward_sc_per_user > 0)) {
    await distributeRewards(admin, challenge)
  }

  revalidatePath('/admin/challenges')
  revalidatePath('/dashboard/challenges')
  return { ok: true }
}

async function distributeRewards(admin: any, challenge: any) {
  const rewardXp = challenge.reward_xp_per_user ?? 0
  const rewardSc = challenge.reward_sc_per_user ?? 0

  // Usuarios que tuvieron actividad durante el período del desafío
  const { data: activeUsers } = await admin
    .from('xp_events')
    .select('user_id')
    .gte('created_at', challenge.starts_at)
    .lte('created_at', challenge.ends_at)

  if (!activeUsers || activeUsers.length === 0) return

  // Deduplicate user IDs
  const userIds: string[] = [...new Set((activeUsers as any[]).map((e: any) => e.user_id))]

  // Repartir en batches para no saturar
  const BATCH = 50
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH)

    await Promise.all(batch.map(async (userId: string) => {
      // Obtener reputación actual
      const { data: rep } = await admin
        .from('user_reputation')
        .select('total_xp, weekly_xp, monthly_xp, salchi_coins')
        .eq('user_id', userId)
        .single()

      if (!rep) return

      const updates: any = {}
      if (rewardXp > 0) {
        updates.total_xp   = (rep.total_xp   ?? 0) + rewardXp
        updates.weekly_xp  = (rep.weekly_xp  ?? 0) + rewardXp
        updates.monthly_xp = (rep.monthly_xp ?? 0) + rewardXp
      }
      if (rewardSc > 0) {
        updates.salchi_coins = (rep.salchi_coins ?? 0) + rewardSc
      }

      await admin.from('user_reputation').update(updates).eq('user_id', userId)

      // Registrar en notificaciones
      await admin.from('notifications').insert({
        user_id: userId,
        type:    'CHALLENGE_REWARD',
        title:   '⚔️ ¡Desafío completado!',
        message: `La comunidad superó "${challenge.title}". Ganaste${rewardXp > 0 ? ` +${rewardXp} XP` : ''}${rewardSc > 0 ? ` +${rewardSc} SC` : ''}.`,
      })
    }))
  }
}
