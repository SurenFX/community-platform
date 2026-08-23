import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as crypto from 'crypto'

// OAuth 2.1 + PKCE de Kick — paso 1 (igual que el hub, pero con scopes de streamer:
// chat:write y events:subscribe para poder operar sorteos en su canal)
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  const verifier  = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state     = crypto.randomBytes(16).toString('base64url')

  const cookieStore = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   600,
    path:     '/',
  }
  cookieStore.set('kick_oauth_verifier', verifier, cookieOpts)
  cookieStore.set('kick_oauth_state', state, cookieOpts)

  const params = new URLSearchParams({
    client_id:             process.env.KICK_CLIENT_ID ?? '',
    response_type:         'code',
    redirect_uri:          `${origin}/auth/kick`,
    scope:                 'user:read channel:read chat:write events:subscribe',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  })

  return NextResponse.redirect(`https://id.kick.com/oauth/authorize?${params.toString()}`)
}
