import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as crypto from 'crypto'

function base64url(input: Buffer): string {
  return input.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Paso 1 del OAuth 2.1 + PKCE de Kick: genera el code_verifier/code_challenge,
// los guarda en cookies httpOnly de corta duración, y redirige a Kick.
// El callback (/auth/kick) los lee para completar el intercambio del code.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  const verifier  = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())
  const state     = base64url(crypto.randomBytes(16))

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
    scope:                 'user:read',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  })

  return NextResponse.redirect(`https://id.kick.com/oauth/authorize?${params.toString()}`)
}
