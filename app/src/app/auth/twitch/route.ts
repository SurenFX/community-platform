import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=twitch_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()             { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  try {
    // Intercambiar el code por un access token de Twitch directamente
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.TWITCH_CLIENT_ID ?? '',
        client_secret: process.env.TWITCH_CLIENT_SECRET ?? '',
        code,
        grant_type:    'authorization_code',
        redirect_uri:  `${origin}/auth/twitch`,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('Token error:', tokenData)
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=token_error`)
    }

    // Obtener info del usuario de Twitch
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Client-Id':     process.env.TWITCH_CLIENT_ID ?? '',
      },
    })

    const userData = await userRes.json()
    const twitchUser = userData.data?.[0]

    if (!twitchUser) {
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=twitch_api`)
    }

    // Guardar en user_social_links usando admin client
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    await adminClient
      .from('user_social_links')
      .upsert({
        user_id:     user.id,
        platform:    'TWITCH',
        external_id: twitchUser.id,
        username:    twitchUser.login,
        is_verified: true,
      }, { onConflict: 'user_id,platform' })

    return NextResponse.redirect(`${origin}/dashboard/configuracion?connected=twitch`)

  } catch (err) {
    console.error('Twitch auth error:', err)
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=unknown`)
  }
}
