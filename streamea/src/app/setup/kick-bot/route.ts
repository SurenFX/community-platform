import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/** Callback del alta de la cuenta bot de Kick. Guarda el token en st_bot_tokens. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const verifier    = cookieStore.get('kick_bot_verifier')?.value
  const expected    = cookieStore.get('kick_bot_state')?.value
  cookieStore.delete('kick_bot_verifier')
  cookieStore.delete('kick_bot_state')

  if (!code || !verifier || !expected || expected !== state) {
    return new NextResponse('Estado inválido o expirado. Volvé a empezar.', { status: 400 })
  }

  try {
    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     process.env.KICK_CLIENT_ID     ?? '',
        client_secret: process.env.KICK_CLIENT_SECRET ?? '',
        redirect_uri:  `${origin}/setup/kick-bot`,
        code_verifier: verifier,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return new NextResponse(`Error obteniendo el token: ${JSON.stringify(tokenData)}`, { status: 400 })
    }

    const userRes  = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()
    const botUser  = userData?.data?.[0]

    const admin = createSupabaseAdmin()
    const { error } = await admin.from('st_bot_tokens').upsert({
      platform:      'KICK',
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at:    new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
      bot_user_id:   botUser?.user_id ? String(botUser.user_id) : null,
      bot_username:  botUser?.name ?? null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'platform' })

    if (error) {
      return new NextResponse(`Token obtenido pero falló el guardado: ${error.message}`, { status: 500 })
    }

    return new NextResponse(
      `Listo! Bot de Kick configurado como "${botUser?.name ?? 'desconocido'}".`,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  } catch (err) {
    return new NextResponse(`Error: ${err}`, { status: 500 })
  }
}
