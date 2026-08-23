import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as crypto from 'crypto'

// OAuth de Twitch — paso 1. Scopes mínimos: identidad (para vincular el canal).
// El bot IRC que opera los sorteos usa su propia cuenta, no el token del streamer.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  const state = crypto.randomBytes(16).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set('twitch_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })

  const params = new URLSearchParams({
    client_id:     process.env.TWITCH_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri:  `${origin}/auth/twitch`,
    scope:         '',
    state,
  })

  return NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`)
}
