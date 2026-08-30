import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as crypto from 'crypto'

/**
 * Alta de la cuenta BOT de Twitch para toda la plataforma (uso interno, una sola vez).
 *
 * Se hace desde la web y no desde el worker porque Twitch exige HTTPS en los
 * redirect URIs (la VM no tiene TLS). Protegido con ADMIN_SETUP_KEY.
 *
 * Uso: /setup/twitch-bot/start?key=<ADMIN_SETUP_KEY>  logueado en Twitch con la
 * cuenta del bot (usar ventana de incognito para no autorizar tu cuenta personal).
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)

  const expected = process.env.ADMIN_SETUP_KEY
  if (!expected || searchParams.get('key') !== expected) {
    return new NextResponse('No autorizado', { status: 401 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('twitch_bot_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })

  const params = new URLSearchParams({
    client_id:     process.env.TWITCH_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri:  `${origin}/setup/twitch-bot`,
    scope:         'chat:read chat:edit',
    force_verify:  'true',   // fuerza elegir cuenta, evita autorizar la equivocada
    state,
  })

  return NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`)
}
