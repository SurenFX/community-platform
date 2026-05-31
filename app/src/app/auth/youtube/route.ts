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

  // Obtener sesión actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  try {
    // Obtener el token de Google de las identidades de Supabase
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token

    if (!providerToken) {
      console.error('No provider token found')
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_token`)
    }

    // Llamar a la API de YouTube con el token del usuario
    // para obtener su Channel ID real
    const ytRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
      {
        headers: { Authorization: `Bearer ${providerToken}` }
      }
    )
    const ytData = await ytRes.json()

    if (ytData.error) {
      console.error('YouTube API error:', ytData.error.message)
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=youtube_api`)
    }

    const channel = ytData.items?.[0]
    if (!channel) {
      // El usuario no tiene canal de YouTube
      return NextResponse.redirect(`${origin}/dashboard/configuracion?error=no_channel`)
    }

    const channelId = channel.id
    const username  = channel.snippet?.title ?? channelId

    // Guardar el link de YouTube en la DB
    const { error: linkError } = await supabase
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

    // Notificar al worker para verificar suscripción
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
    }).catch(() => {}) // no bloquear si el worker no responde

    return NextResponse.redirect(`${origin}/dashboard/configuracion?connected=youtube`)

  } catch (err) {
    console.error('YouTube auth error:', err)
    return NextResponse.redirect(`${origin}/dashboard/configuracion?error=unknown`)
  }
}
