'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function disconnectSocialLink(platform: string): Promise<{ error?: string }> {
  // Verificar sesión del usuario
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Usar admin client para bypassear RLS en el delete
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('user_social_links')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', platform)

  if (error) {
    console.error('disconnectSocialLink error:', error.message)
    return { error: 'No se pudo desconectar la cuenta' }
  }

  return {}
}

export async function toggleSocialLinkPublic(platform: string, isPublic: boolean): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('user_social_links')
    .update({ is_public: isPublic })
    .eq('user_id', user.id)
    .eq('platform', platform)

  if (error) return { error: 'No se pudo actualizar la visibilidad' }
  return {}
}

export async function setUserAdmin(targetUserId: string, isAdmin: boolean): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que el solicitante es admin
  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!me?.is_admin) return { error: 'Sin permisos' }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', targetUserId)

  if (error) {
    console.error('setUserAdmin error:', error.message)
    return { error: 'No se pudo actualizar el rol' }
  }
  return {}
}

export async function setUserBanned(targetUserId: string, isBanned: boolean): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: me } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!me?.is_admin) return { error: 'Sin permisos' }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('profiles')
    .update({ is_banned: isBanned })
    .eq('id', targetUserId)

  if (error) {
    console.error('setUserBanned error:', error.message)
    return { error: 'No se pudo actualizar el estado' }
  }
  return {}
}

export async function enterRaffle(raffleId: string, ticketsToUse: number): Promise<{ error?: string }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (ticketsToUse < 1) return { error: 'Mínimo 1 ticket' }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verificar tickets disponibles
  const { data: rep } = await admin
    .from('user_reputation').select('raffle_tickets').eq('user_id', user.id).single()
  const available = (rep as any)?.raffle_tickets ?? 0
  if (available < ticketsToUse) return { error: `Solo tenés ${available} tickets disponibles` }

  // Verificar que el sorteo existe y está activo
  const { data: raffle } = await admin
    .from('raffles').select('id, status').eq('id', raffleId).single()
  if (!raffle || (raffle as any).status !== 'ACTIVE') return { error: 'Sorteo no disponible' }

  // Upsert en raffle_pools (acumula tickets si ya participó)
  const { data: existing } = await admin
    .from('raffle_pools').select('id, tickets').eq('raffle_id', raffleId).eq('user_id', user.id).single()

  if (existing) {
    await admin.from('raffle_pools')
      .update({ tickets: (existing as any).tickets + ticketsToUse })
      .eq('id', (existing as any).id)
  } else {
    await admin.from('raffle_pools')
      .insert({ raffle_id: raffleId, user_id: user.id, tickets: ticketsToUse })
  }

  // Descontar tickets del usuario
  await admin.from('user_reputation')
    .update({ raffle_tickets: available - ticketsToUse })
    .eq('user_id', user.id)

  return {}
}
