import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
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
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token

    if (!providerToken) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=no_token`)
    }

    // Obtener info del usuario de Twitch con el token
    const twitchRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${providerToken}`,
        'Client-Id':     process.env.TWITCH_CLIENT_ID ?? '',
      },
    })
    const twitchData = await twitchRes.json()
    const twitchUser = twitchData.data?.[0]

    if (!twitchUser) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=twitch_api`)
    }

    const twitchId       = twitchUser.id
    const twitchUsername = twitchUser.login  // username en minúsculas

    // Guardar en user_social_links
    const { error } = await supabase
      .from('user_social_links')
      .upsert({
        user_id:     user.id,
        platform:    'TWITCH',
        external_id: twitchId,
        username:    twitchUsername,
        is_verified: true,
      }, { onConflict: 'user_id,platform' })

    if (error) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=db_error`)
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?connected=twitch`)

  } catch (err) {
    console.error('Twitch auth error:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=unknown`)
  }
}
