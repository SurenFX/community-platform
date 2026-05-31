import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=youtube_denied`)
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

  // Intercambiar code → session (el provider_token está en la respuesta directa)
  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !session) {
    console.error('YouTube session exchange error:', exchangeError?.message)
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_token`)
  }

  const providerToken = session.provider_token
  const user = session.user

  if (!providerToken) {
    console.error('No provider token after exchange')
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_token`)
  }

  try {
    const ytRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
      { headers: { Authorization: `Bearer ${providerToken}` } }
    )
    const ytData = await ytRes.json()

    if (ytData.error) {
      console.error('YouTube API error:', ytData.error.message)
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=youtube_api`)
    }

    const channel = ytData.items?.[0]
    if (!channel) {
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_channel`)
    }

    const channelId = channel.id
    const username  = channel.snippet?.title ?? channelId

    // Usar admin client para bypassear RLS — igual que en el route de Twitch
    const { createClient: createAdmin } = await import('@supabase/supabase-js')
    const adminClient = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error: linkError } = await adminClient
      .from('user_social_links')
      .upsert({
        user_id:     user.id,
        platform:    'YOUTUBE',
        external_id: channelId,
        username,
        is_verified: true,
      }, { onConflict: 'user_id,platform' })

    if (linkError) {
      console.error('Error saving YouTube link:', linkError.message)
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=db_error`)
    }

    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:3001'
    await fetch(`${workerUrl}/youtube/connected`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-worker-secret': process.env.WORKER_SECRET ?? '',
      },
      body: JSON.stringify({
        userId:    user.id,
        discordId: user.user_metadata?.provider_id,
        ytId:      channelId,
      }),
    }).catch(() => {})

    return NextResponse.redirect(`${origin}/dashboard/configuracion?connected=youtube`)

  } catch (err) {
    console.error('YouTube auth error:', err)
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=unknown`)
  }
}
