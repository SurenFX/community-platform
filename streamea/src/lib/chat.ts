import { createSupabaseAdmin } from './supabase/admin'
import { sendKickChat } from './kick'
import { sendTwitchChat } from './twitch'

export type Platform = 'KICK' | 'TWITCH'

export interface Tenant {
  id:            string   // st_streamers.id
  displayName:   string
  broadcasterId: string   // id numerico del canal en la plataforma
}

/** Resuelve el streamer dueño de un canal a partir del id del broadcaster. */
export async function findTenant(
  platform: Platform, broadcasterId: string,
): Promise<Tenant | null> {
  const admin  = createSupabaseAdmin()
  const column = platform === 'KICK' ? 'kick_user_id' : 'twitch_user_id'

  const { data } = await admin
    .from('st_streamers')
    .select('id, display_name')
    .eq(column, String(broadcasterId))
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return null
  const row = data as { id: string; display_name: string }
  return { id: row.id, displayName: row.display_name, broadcasterId: String(broadcasterId) }
}

export async function say(
  platform: Platform, broadcasterId: string, message: string,
): Promise<boolean> {
  return platform === 'KICK'
    ? sendKickChat(broadcasterId, message)
    : sendTwitchChat(broadcasterId, message)
}

/**
 * Procesa un mensaje de chat: comandos de gestión, comandos custom y sorteos.
 * Es la misma lógica para Kick y Twitch — solo cambia cómo llega el evento.
 */
export async function handleChatMessage(opts: {
  platform:  Platform
  tenant:    Tenant
  username:  string
  content:   string
  isMod:     boolean
}): Promise<void> {
  const { platform, tenant, username, isMod } = opts
  const raw     = opts.content.trim()
  const content = raw.toLowerCase()
  if (!content) return

  await checkRaffleEntry(platform, tenant, username, content)

  if (!content.startsWith('!')) return

  if (content.startsWith('!addcom ') || content.startsWith('!delcom ')) {
    if (!isMod) return
    return content.startsWith('!addcom ')
      ? addCommand(platform, tenant, raw)
      : delCommand(platform, tenant, content)
  }

  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('st_commands')
    .select('response, cooldown_seconds, uses, id')
    .eq('streamer_id', tenant.id)
    .eq('command', content)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return
  const cmd = data as { id: string; response: string; cooldown_seconds: number; uses: number }

  // Cooldown persistido (serverless: no hay memoria entre invocaciones)
  const key = `${tenant.id}:${platform}:${content}`
  if (!(await takeCooldown(key, cmd.cooldown_seconds ?? 30))) return

  await say(platform, tenant.broadcasterId, cmd.response)
  await admin.from('st_commands').update({ uses: (cmd.uses ?? 0) + 1 }).eq('id', cmd.id)
}

async function addCommand(platform: Platform, tenant: Tenant, raw: string) {
  const rest     = raw.slice('!addcom '.length).trim()
  const spaceIdx = rest.indexOf(' ')
  if (spaceIdx < 0) return

  const command  = rest.slice(0, spaceIdx).toLowerCase()
  const response = rest.slice(spaceIdx + 1).trim()
  if (!command.startsWith('!') || !response) return

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('st_commands')
    .upsert({ streamer_id: tenant.id, command, response }, { onConflict: 'streamer_id,command' })

  if (error) {
    console.warn('addCommand:', error.message)
    return
  }
  await say(platform, tenant.broadcasterId, `Comando ${command} guardado!`)
}

async function delCommand(platform: Platform, tenant: Tenant, content: string) {
  const command = content.slice('!delcom '.length).trim()
  if (!command.startsWith('!')) return

  const admin = createSupabaseAdmin()
  await admin
    .from('st_commands')
    .delete()
    .eq('streamer_id', tenant.id)
    .eq('command', command)

  await say(platform, tenant.broadcasterId, `Comando ${command} eliminado!`)
}

async function checkRaffleEntry(
  platform: Platform, tenant: Tenant, username: string, content: string,
) {
  const admin = createSupabaseAdmin()

  const { data: raffle } = await admin
    .from('st_raffles')
    .select('id, keyword')
    .eq('streamer_id', tenant.id)
    .eq('platform', platform)
    .eq('status', 'active')
    .maybeSingle()

  if (!raffle) return
  const r = raffle as { id: string; keyword: string }
  if (content !== r.keyword.toLowerCase().trim()) return

  // El UNIQUE(raffle_id, username) evita duplicados
  await admin
    .from('st_raffle_entries')
    .insert({ raffle_id: r.id, username: username.toLowerCase() })
}

/**
 * Cooldown con la DB (en serverless no hay estado entre invocaciones).
 * Devuelve true si se puede ejecutar y marca el uso.
 */
async function takeCooldown(key: string, seconds: number): Promise<boolean> {
  const admin  = createSupabaseAdmin()
  const cutoff = new Date(Date.now() - seconds * 1000).toISOString()

  const { data } = await admin
    .from('st_cooldowns')
    .select('key, used_at')
    .eq('key', key)
    .maybeSingle()

  if (data && (data as { used_at: string }).used_at > cutoff) return false

  await admin
    .from('st_cooldowns')
    .upsert({ key, used_at: new Date().toISOString() }, { onConflict: 'key' })

  return true
}
