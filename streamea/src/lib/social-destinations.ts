import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createSupabaseAdmin } from './supabase/admin'

export type SocialPlatform = 'DISCORD' | 'TELEGRAM'
export type SocialConfig = { platform: 'DISCORD'; webhook: string } | { platform: 'TELEGRAM'; token: string; chatId: string }

export function validateSocialConfig(config: SocialConfig): boolean {
  if (config.platform === 'TELEGRAM') return /^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(config.token) && /^-?\d{1,20}$/.test(config.chatId)
  try {
    const url = new URL(config.webhook)
    return url.protocol === 'https:' && url.hostname === 'discord.com' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && /^\/api\/webhooks\/\d{10,25}\/[A-Za-z0-9_-]{20,150}$/.test(url.pathname)
  } catch { return false }
}

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Configuración del servidor incompleta')
  return createHash('sha256').update(`streamea-social-v1:${secret}`).digest()
}

export function encryptSocialConfig(streamerId: string, config: SocialConfig): string {
  if (!validateSocialConfig(config)) throw new Error('Destino inválido')
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), nonce)
  cipher.setAAD(Buffer.from(`${streamerId}:${config.platform}`))
  const body = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()])
  return [nonce, cipher.getAuthTag(), body].map(value => value.toString('base64url')).join('.')
}

export function decryptSocialConfig(streamerId: string, platform: SocialPlatform, sealed: string): SocialConfig {
  const parts = sealed.split('.')
  if (parts.length !== 3) throw new Error('Destino inválido')
  const [nonce, tag, body] = parts.map(value => Buffer.from(value, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', key(), nonce)
  cipher.setAAD(Buffer.from(`${streamerId}:${platform}`))
  cipher.setAuthTag(tag)
  const config = JSON.parse(Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8')) as SocialConfig
  if (config.platform !== platform || !validateSocialConfig(config)) throw new Error('Destino inválido')
  return config
}

export async function sendSocialMessage(streamerId: string, platform: SocialPlatform, message: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.from('st_social_destinations')
    .select('encrypted_config,is_active').eq('streamer_id', streamerId).eq('platform', platform).maybeSingle()
  if (error || !data?.is_active || !message || [...message].length > 400) return false
  try {
    const config = decryptSocialConfig(streamerId, platform, data.encrypted_config)
    const url = config.platform === 'DISCORD' ? `${config.webhook}?wait=true` : `https://api.telegram.org/bot${config.token}/sendMessage`
    const body = config.platform === 'DISCORD' ? { content: message, allowed_mentions: { parse: [] } }
      : { chat_id: config.chatId, text: message, link_preview_options: { is_disabled: true } }
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return false
    const result = await response.json().catch(() => null)
    return config.platform === 'DISCORD' ? typeof result?.id === 'string' : result?.ok === true && Boolean(result.result?.message_id)
  } catch {
    // Ni URLs de webhook ni tokens deben terminar en logs o mensajes del panel.
    return false
  }
}
