import * as crypto from 'crypto'
import { createSupabaseAdmin } from './supabase/admin'

const API_BASE       = 'https://api.kick.com/public/v1'
const OAUTH_URL      = 'https://id.kick.com/oauth/token'
const PUBLIC_KEY_URL = `${API_BASE}/public-key`

export const KICK_EVENTS = [
  'chat.message.sent',
  'channel.followed',
  'channel.subscription.new',
  'channel.subscription.renewal',
] as const

const clientId     = () => process.env.KICK_CLIENT_ID     ?? ''
const clientSecret = () => process.env.KICK_CLIENT_SECRET ?? ''

// --- Tokens ---

let appTokenCache: { token: string; expiry: number } | null = null

/** Token de aplicación (client_credentials). Sirve para suscripciones de eventos. */
export async function getKickAppToken(): Promise<string | null> {
  if (appTokenCache && Date.now() < appTokenCache.expiry) return appTokenCache.token

  const res = await fetch(OAUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId(),
      client_secret: clientSecret(),
      grant_type:    'client_credentials',
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.error('Kick getAppToken:', res.status, await res.text())
    return null
  }

  const data = await res.json()
  appTokenCache = {
    token:  data.access_token,
    expiry: Date.now() + (data.expires_in - 300) * 1000,
  }
  return appTokenCache.token
}

/** Token de la cuenta bot de la plataforma, refrescándolo si está por vencer. */
export async function getKickBotToken(): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('st_bot_tokens')
    .select('*')
    .eq('platform', 'KICK')
    .maybeSingle()

  if (!data) {
    console.warn('Kick: no hay token del bot. Correr /setup/kick-bot/start')
    return null
  }

  const row       = data as Record<string, string>
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
  if (Date.now() < expiresAt - 5 * 60 * 1000) return row.access_token
  if (!row.refresh_token) return row.access_token

  const res = await fetch(OAUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: row.refresh_token,
      client_id:     clientId(),
      client_secret: clientSecret(),
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.warn('Kick refresh del bot falló:', res.status, '— rehacer /setup/kick-bot/start')
    return row.access_token
  }

  const json = await res.json()
  await admin
    .from('st_bot_tokens')
    .update({
      access_token:  json.access_token,
      refresh_token: json.refresh_token ?? row.refresh_token,
      expires_at:    new Date(Date.now() + json.expires_in * 1000).toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq('platform', 'KICK')

  return json.access_token
}

// --- Chat ---

/** Manda un mensaje al chat de un canal, con la identidad de la cuenta bot. */
export async function sendKickChat(broadcasterId: string, message: string): Promise<boolean> {
  // El bot oficial habla en el canal vinculado al token del streamer.
  // Kick ignora broadcaster_user_id con type=bot: nunca usar un token global.
  const token = await getKickChannelToken(broadcasterId)
  if (!token) return false

  const res = await fetch(`${API_BASE}/chat`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({
      broadcaster_user_id: Number(broadcasterId),
      content: message.slice(0, 500),
      type:    'bot',
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.warn('Kick sendChat:', res.status, await res.text())
    return false
  }
  const result = await res.json()
  return result?.data?.is_sent === true
}

async function getKickChannelToken(broadcasterId: string): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('st_streamers')
    .select('id,kick_access_token,kick_refresh_token,kick_expires_at')
    .eq('kick_user_id', broadcasterId).maybeSingle()
  if (error || !data?.kick_access_token) return null
  const expiry = Date.parse(data.kick_expires_at ?? '')
  if (Number.isFinite(expiry) && Date.now() < expiry - 300000) return data.kick_access_token
  if (!data.kick_refresh_token) return null
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token',
      refresh_token: data.kick_refresh_token, client_id: clientId(), client_secret: clientSecret() }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const fresh = await res.json()
  if (!fresh.access_token || !fresh.expires_in) return null
  const { error: saveError } = await admin.from('st_streamers').update({
    kick_access_token: fresh.access_token,
    kick_refresh_token: fresh.refresh_token ?? data.kick_refresh_token,
    kick_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', data.id)
  return saveError ? null : fresh.access_token
}

// --- Suscripciones de eventos ---

/** Crea las suscripciones de webhook que le falten a un canal. */
export async function ensureKickSubscriptions(broadcasterId: string): Promise<boolean> {
  const token = await getKickAppToken()
  if (!token) return false

  const have = new Set<string>()
  try {
    const res = await fetch(
      `${API_BASE}/events/subscriptions?broadcaster_user_id=${broadcasterId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (res.ok) {
      const json = await res.json()
      for (const sub of (json?.data ?? []) as { broadcaster_user_id: number; event: string }[]) {
        if (String(sub.broadcaster_user_id) === String(broadcasterId)) have.add(sub.event)
      }
    }
  } catch (err) {
    console.warn('Kick listar suscripciones:', err)
  }

  const missing = KICK_EVENTS.filter(e => !have.has(e))
  if (missing.length === 0) return true

  const res = await fetch(`${API_BASE}/events/subscriptions`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({
      broadcaster_user_id: Number(broadcasterId),
      method: 'webhook',
      events: missing.map(name => ({ name, version: 1 })),
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.warn('Kick crear suscripciones:', res.status, await res.text())
    return false
  }
  return true
}

// --- Firma del webhook ---

let publicKeyCache: string | null = null

async function getKickPublicKey(): Promise<string | null> {
  if (publicKeyCache) return publicKeyCache
  try {
    const res = await fetch(PUBLIC_KEY_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    publicKeyCache = data?.data?.public_key ?? null
    return publicKeyCache
  } catch {
    return null
  }
}

export async function verifyKickSignature(
  messageId: string, timestamp: string, rawBody: string, signatureB64: string,
): Promise<boolean> {
  const publicKey = await getKickPublicKey()
  if (!publicKey) return false
  try {
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(`${messageId}.${timestamp}.${rawBody}`)
    verifier.end()
    return verifier.verify(publicKey, signatureB64, 'base64')
  } catch {
    return false
  }
}
