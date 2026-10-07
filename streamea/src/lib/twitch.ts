import * as crypto from 'crypto'
import { createSupabaseAdmin } from './supabase/admin'

const OAUTH_URL  = 'https://id.twitch.tv/oauth2/token'
const HELIX_BASE = 'https://api.twitch.tv/helix'

const clientId     = () => process.env.TWITCH_CLIENT_ID     ?? ''
const clientSecret = () => process.env.TWITCH_CLIENT_SECRET ?? ''

// --- Tokens ---

let appTokenCache: { token: string; expiry: number } | null = null

export async function getTwitchAppToken(): Promise<string | null> {
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
    console.error('Twitch getAppToken:', res.status, await res.text())
    return null
  }

  const data = await res.json()
  appTokenCache = {
    token:  data.access_token,
    expiry: Date.now() + (data.expires_in - 300) * 1000,
  }
  return appTokenCache.token
}

export interface TwitchBot {
  token:    string
  userId:   string
  username: string
}

/** Cuenta bot de la plataforma (token + identidad), refrescando si hace falta. */
export async function getTwitchBot(): Promise<TwitchBot | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('st_bot_tokens')
    .select('*')
    .eq('platform', 'TWITCH')
    .maybeSingle()

  if (!data) {
    console.warn('Twitch: no hay bot configurado. Correr /setup/twitch-bot/start')
    return null
  }

  const row       = data as Record<string, string>
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0

  if (Date.now() < expiresAt - 10 * 60 * 1000) {
    return { token: row.access_token, userId: row.bot_user_id, username: row.bot_username }
  }
  if (!row.refresh_token) {
    return { token: row.access_token, userId: row.bot_user_id, username: row.bot_username }
  }

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
    console.warn('Twitch refresh del bot falló:', res.status, '— rehacer /setup/twitch-bot/start')
    return { token: row.access_token, userId: row.bot_user_id, username: row.bot_username }
  }

  const json = await res.json()
  await admin
    .from('st_bot_tokens')
    .update({
      access_token:  json.access_token,
      refresh_token: json.refresh_token ?? row.refresh_token,
      expires_at:    new Date(Date.now() + (json.expires_in ?? 14400) * 1000).toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq('platform', 'TWITCH')

  return { token: json.access_token, userId: row.bot_user_id, username: row.bot_username }
}

/** Token válido del streamer (para acciones sobre su canal), con refresh. */
export async function getStreamerTwitchToken(streamerId: string): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('st_streamers')
    .select('twitch_access_token, twitch_refresh_token, twitch_expires_at')
    .eq('id', streamerId)
    .maybeSingle()

  const row = data as Record<string, string> | null
  if (!row?.twitch_access_token) return null

  const expiresAt = row.twitch_expires_at ? new Date(row.twitch_expires_at).getTime() : 0
  if (Date.now() < expiresAt - 5 * 60 * 1000) return row.twitch_access_token
  if (!row.twitch_refresh_token) return row.twitch_access_token

  const res = await fetch(OAUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: row.twitch_refresh_token,
      client_id:     clientId(),
      client_secret: clientSecret(),
    }),
    cache: 'no-store',
  })

  if (!res.ok) return null

  const json = await res.json()
  await admin
    .from('st_streamers')
    .update({
      twitch_access_token:  json.access_token,
      twitch_refresh_token: json.refresh_token ?? row.twitch_refresh_token,
      twitch_expires_at:    new Date(Date.now() + (json.expires_in ?? 14400) * 1000).toISOString(),
      updated_at:           new Date().toISOString(),
    })
    .eq('id', streamerId)

  return json.access_token
}

// --- Chat (sin IRC: Helix REST) ---

export async function sendTwitchChat(broadcasterId: string, message: string): Promise<boolean> {
  const bot = await getTwitchBot()
  if (!bot) return false

  const res = await fetch(`${HELIX_BASE}/chat/messages`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${bot.token}`,
      'Client-Id':    clientId(),
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id:      bot.userId,
      message:        message.slice(0, 480),
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.warn('Twitch sendChat:', res.status, await res.text())
    return false
  }
  const result = await res.json().catch(() => null)
  if (result?.data?.[0]?.is_sent !== true) {
    console.warn('Twitch no confirmó el envío:', result?.data?.[0]?.drop_reason?.code ?? 'respuesta inválida')
    return false
  }
  return true
}

// --- EventSub ---

const CALLBACK = () => `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/twitch/webhook`

/** Suscribe el chat del canal via EventSub (webhook). Requiere que el bot sea mod. */
export async function ensureTwitchSubscription(broadcasterId: string): Promise<boolean> {
  const token = await getTwitchAppToken()
  const bot   = await getTwitchBot()
  const secret = process.env.TWITCH_EVENTSUB_SECRET
  if (!token || !bot || !secret || !process.env.NEXT_PUBLIC_SITE_URL) return false

  // ¿Ya existe una suscripción activa para este canal?
  try {
    const listRes = await fetch(
      `${HELIX_BASE}/eventsub/subscriptions?type=channel.chat.message&status=enabled`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId() },
        cache: 'no-store',
      },
    )
    if (listRes.ok) {
      const json = await listRes.json()
      const exists = (json?.data ?? []).some(
        (s: { condition?: { broadcaster_user_id?: string } }) =>
          s.condition?.broadcaster_user_id === String(broadcasterId),
      )
      if (exists) return true
    }
  } catch (err) {
    console.warn('Twitch listar EventSub:', err)
  }

  const res = await fetch(`${HELIX_BASE}/eventsub/subscriptions`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      'Client-Id':    clientId(),
    },
    body: JSON.stringify({
      type:    'channel.chat.message',
      version: '1',
      condition: {
        broadcaster_user_id: String(broadcasterId),
        user_id:             bot.userId,
      },
      transport: {
        method:   'webhook',
        callback: CALLBACK(),
        secret,
      },
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.warn('Twitch crear EventSub:', res.status, await res.text())
    return false
  }
  return true
}

/** Agrega la cuenta bot como moderador del canal, con el token del streamer. */
export async function makeBotModerator(
  streamerId: string, broadcasterId: string,
): Promise<{ ok: boolean; message: string }> {
  const bot = await getTwitchBot()
  if (!bot) return { ok: false, message: 'Falta configurar la cuenta bot de Twitch' }

  const token = await getStreamerTwitchToken(streamerId)
  if (!token) return { ok: false, message: 'Reconectá tu cuenta de Twitch' }

  const res = await fetch(
    `${HELIX_BASE}/moderation/moderators?broadcaster_id=${broadcasterId}&user_id=${bot.userId}`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId() },
      cache: 'no-store',
    },
  )

  if (res.status === 204) return { ok: true, message: 'Bot agregado como moderador' }
  if (res.status === 422) return { ok: true, message: 'El bot ya era moderador' }
  if (res.status === 401) {
    return { ok: false, message: 'Falta permiso: reconectá Twitch para autorizar moderadores' }
  }

  console.warn('Twitch makeBotModerator:', res.status, await res.text())
  return { ok: false, message: `Twitch respondió ${res.status}` }
}

// --- Firma del webhook (HMAC) ---

export function verifyTwitchSignature(
  messageId: string, timestamp: string, rawBody: string, signature: string,
): boolean {
  const secret = process.env.TWITCH_EVENTSUB_SECRET
  if (!secret || !signature) return false

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(`${messageId}${timestamp}${rawBody}`)
    .digest('hex')

  const expected = `sha256=${hmac}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
