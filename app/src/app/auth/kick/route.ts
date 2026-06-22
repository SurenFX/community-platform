import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=kick_denied`)
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_code`)
  }

  const cookieStore   = await cookies()
  const verifier      = cookieStore.get('kick_oauth_verifier')?.value
  const expectedState = cookieStore.get('kick_oauth_state')?.value

  cookieStore.delete('kick_oauth_verifier')
  cookieStore.delete('kick_oauth_state')

  if (!verifier || !expectedState || expectedState !== state) {
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=kick_state`)
  }

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
    // Intercambiar el code por un access token de Kick (OAuth 2.1 + PKCE)
    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     process.env.KICK_CLIENT_ID ?? '',
        client_secret: process.env.KICK_CLIENT_SECRET ?? '',
        redirect_uri:  `${origin}/auth/kick`,
        code_verifier: verifier,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      console.error('Kick token error:', tokenData)
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=token_error`)
    }

    // Obtener info del usuario autorizado (user_id numerico + nombre)
    const userRes = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const userData = await userRes.json()
    const kickUser = userData?.data?.[0]

    if (!kickUser?.user_id) {
      console.error('Kick user error:', userData)
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=kick_api`)
    }

    // Guardar en user_social_links usando admin client (bypassa RLS)
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
        platform:    'KICK',
        external_id: String(kickUser.user_id),
        username:    kickUser.name ?? `kick_${kickUser.user_id}`,
        is_verified: true,
      }, { onConflict: 'user_id,platform' })

    return NextResponse.redirect(`${origin}/dashboard/configuracion?connected=kick`)

  } catch (err) {
    console.error('Kick auth error:', err)
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=unknown`)
  }
}
