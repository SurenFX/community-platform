import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

/** Callback del alta de la cuenta bot de Twitch. Guarda el token en st_bot_tokens. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const expected    = cookieStore.get('twitch_bot_state')?.value
  cookieStore.delete('twitch_bot_state')

  if (!code || !expected || expected !== state) {
    return new NextResponse('Estado inválido o expirado. Volvé a empezar.', { status: 400 })
  }

  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.TWITCH_CLIENT_ID ?? '',
        client_secret: process.env.TWITCH_CLIENT_SECRET ?? '',
        code,
        grant_type:    'authorization_code',
        redirect_uri:  `${origin}/setup/twitch-bot`,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Twitch bot token error:', tokenData)
      return new NextResponse(`Error obteniendo el token: ${JSON.stringify(tokenData)}`, { status: 400 })
    }

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id':   process.env.TWITCH_CLIENT_ID ?? '',
      },
    })
    const userData = await userRes.json()
    const botUser  = userData?.data?.[0]

    if (!userRes.ok || !botUser) {
      return new NextResponse('No pudimos leer la cuenta del bot en Twitch.', { status: 400 })
    }

    const admin = createSupabaseAdmin()
    const { error } = await admin.from('st_bot_tokens').upsert({
      platform:      'TWITCH',
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at:    new Date(Date.now() + (tokenData.expires_in ?? 14400) * 1000).toISOString(),
      bot_user_id:   botUser.id,
      bot_username:  botUser.login,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'platform' })

    if (error) {
      return new NextResponse(`Token obtenido pero falló el guardado: ${error.message}`, { status: 500 })
    }

    return new NextResponse(
      `Bot de Twitch configurado como "${botUser.login}". Volvé al panel, conectá tu canal y activá la lectura del chat.`,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  } catch (err) {
    console.error('Twitch bot auth error:', err)
    return new NextResponse(`Error: ${err}`, { status: 500 })
  }
}
