import { createSupabaseAdmin } from './supabase/admin'

/** Reserva atómica: si la DB falla, no enviamos una respuesta sin protección. */
export async function takeCooldown(key: string, seconds: number): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.rpc('st_take_cooldown', {
    p_key: key,
    p_seconds: Math.max(1, Math.ceil(seconds)),
  })
  if (error) {
    console.warn('No se pudo reservar el turno del bot:', error.message)
    return false
  }
  return data === true
}

export function isFreshEvent(timestamp: string, now = Date.now()): boolean {
  const sentAt = Date.parse(timestamp)
  return Number.isFinite(sentAt) && sentAt <= now + 60_000 && sentAt >= now - 600_000
}
