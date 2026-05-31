import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'

  // Discord rechazó el OAuth (usuario canceló, permisos denegados, etc.)
  if (error) {
    console.error('OAuth error:', searchParams.get('error_description'))
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Discord rechazó el acceso')}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()                  { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Session exchange error:', exchangeError.message)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Error al iniciar sesión')}`
    )
  }

  // Verificar que el perfil se creó correctamente (lo crea el trigger)
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', user.id)
      .single()

    if (!profile) {
      // El trigger falló — crear el perfil manualmente como fallback
      console.warn('Trigger no creó el perfil, creando manualmente')
      const discordId  = user.user_metadata?.provider_id ?? user.id
      const discordTag = user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? 'user'
      const avatarUrl  = user.user_metadata?.avatar_url ?? null
      const username   = discordTag.split('#')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'user'

      await supabase.from('profiles').upsert({
        id:          user.id,
        discord_id:  discordId,
        discord_tag: discordTag,
        username:    username + '_' + user.id.slice(0, 4),
        avatar_url:  avatarUrl,
      })
    }
  }

  // Redirigir al destino original — nunca a una URL externa
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'
  return NextResponse.redirect(`${origin}${safeRedirect}`)
}
