import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as crypto from 'crypto'

// OAuth de Twitch — paso 1.
// `channel:manage:moderators` permite que Streamea agregue su bot como moderador del
// canal con un clic (en Kick esto no se puede: su API solo tiene ban/unban).
// El bot que escribe en el chat usa su propia cuenta, no el token del streamer.
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
    // manage:moderators → poder agregar el bot como mod con un clic
    // channel:bot       → permitir que el bot lea el chat via EventSub
    scope:         'channel:manage:moderators channel:bot',
    state,
  })

  return NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`)
}
