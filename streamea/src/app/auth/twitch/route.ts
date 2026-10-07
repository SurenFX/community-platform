import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

// Callback del OAuth de Twitch: guarda identidad + tokens en st_streamers
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) return NextResponse.redirect(`${origin}/panel?error=twitch_denied`)
  if (!code)  return NextResponse.redirect(`${origin}/panel?error=no_code`)

  const cookieStore   = await cookies()
  const expectedState = cookieStore.get('twitch_oauth_state')?.value
  cookieStore.delete('twitch_oauth_state')

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${origin}/panel?error=twitch_state`)
  }

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method:  'POST',
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
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Streamea Twitch token error:', tokenData)
      return NextResponse.redirect(`${origin}/panel?error=twitch_token`)
    }

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Client-Id':     process.env.TWITCH_CLIENT_ID ?? '',
      },
    })
    const userData   = await userRes.json()
    const twitchUser = userData.data?.[0]
    if (!userRes.ok || !twitchUser) {
      return NextResponse.redirect(`${origin}/panel?error=twitch_api`)
    }

    const admin = createSupabaseAdmin()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString()

    const { data: existing } = await admin
      .from('st_streamers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const fields = {
      twitch_login:         twitchUser.login,
      twitch_user_id:       twitchUser.id,
      twitch_access_token:  tokenData.access_token,
      twitch_refresh_token: tokenData.refresh_token ?? null,
      twitch_expires_at:    expiresAt,
      updated_at:           new Date().toISOString(),
    }

    if (existing) {
      const { error: saveError } = await admin.from('st_streamers').update(fields).eq('id', existing.id)
      if (saveError) return NextResponse.redirect(`${origin}/panel?error=twitch_save`)
    } else {
      const { error: saveError } = await admin.from('st_streamers').insert({
        user_id:      user.id,
        display_name: twitchUser.display_name ?? twitchUser.login,
        ...fields,
      })
      if (saveError) return NextResponse.redirect(`${origin}/panel?error=twitch_save`)
    }

    return NextResponse.redirect(`${origin}/panel?connected=twitch`)
  } catch (err) {
    console.error('Streamea Twitch auth error:', err)
    return NextResponse.redirect(`${origin}/panel?error=unknown`)
  }
}
