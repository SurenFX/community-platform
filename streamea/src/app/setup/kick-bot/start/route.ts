import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as crypto from 'crypto'

export const runtime = 'nodejs'

/**
 * Alta de la cuenta BOT de Kick (uso interno, una sola vez).
 * Antes vivía en el worker; ahora acá, con HTTPS de Vercel — así que ya no hace falta
 * el rodeo por localhost:1337.
 *
 * Uso: /setup/kick-bot/start?key=<ADMIN_SETUP_KEY> logueado en Kick con la cuenta bot.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)

  const expected = process.env.ADMIN_SETUP_KEY
  if (!expected || searchParams.get('key') !== expected) {
    return new NextResponse('No autorizado', { status: 401 })
  }

  const verifier  = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state     = crypto.randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  const opts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   600,
    path:     '/',
  }
  cookieStore.set('kick_bot_verifier', verifier, opts)
  cookieStore.set('kick_bot_state', state, opts)

  const params = new URLSearchParams({
    client_id:             process.env.KICK_CLIENT_ID ?? '',
    response_type:         'code',
    redirect_uri:          `${origin}/setup/kick-bot`,
    scope:                 'user:read channel:read chat:write events:subscribe',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  })

  return NextResponse.redirect(`https://id.kick.com/oauth/authorize?${params.toString()}`)
}
