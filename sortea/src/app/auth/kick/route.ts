import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

// Callback del OAuth de Kick: guarda identidad + tokens en sortea_streamers
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) return NextResponse.redirect(`${origin}/panel?error=kick_denied`)
  if (!code)  return NextResponse.redirect(`${origin}/panel?error=no_code`)

  const cookieStore   = await cookies()
  const verifier      = cookieStore.get('kick_oauth_verifier')?.value
  const expectedState = cookieStore.get('kick_oauth_state')?.value
  cookieStore.delete('kick_oauth_verifier')
  cookieStore.delete('kick_oauth_state')

  if (!verifier || !expectedState || expectedState !== state) {
    return NextResponse.redirect(`${origin}/panel?error=kick_state`)
  }

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  try {
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
      console.error('Sortea Kick token error:', tokenData)
      return NextResponse.redirect(`${origin}/panel?error=kick_token`)
    }

    const userRes  = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()
    const kickUser = userData?.data?.[0]
    if (!kickUser?.user_id) {
      console.error('Sortea Kick user error:', userData)
      return NextResponse.redirect(`${origin}/panel?error=kick_api`)
    }

    // El slug del canal se resuelve con la API de channels (token del streamer)
    let kickSlug: string | null = null
    try {
      const chRes  = await fetch('https://api.kick.com/public/v1/channels', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const chData = await chRes.json()
      kickSlug = chData?.data?.[0]?.slug ?? null
    } catch { /* opcional */ }

    const admin = createSupabaseAdmin()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString()

    const { data: existing } = await admin
      .from('sortea_streamers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const fields = {
      kick_slug:          kickSlug ?? (kickUser.name?.toLowerCase() ?? null),
      kick_user_id:       String(kickUser.user_id),
      kick_access_token:  tokenData.access_token,
      kick_refresh_token: tokenData.refresh_token ?? null,
      kick_expires_at:    expiresAt,
      updated_at:         new Date().toISOString(),
    }

    if (existing) {
      await admin.from('sortea_streamers').update(fields).eq('id', existing.id)
    } else {
      await admin.from('sortea_streamers').insert({
        user_id:      user.id,
        display_name: kickUser.name ?? `kick_${kickUser.user_id}`,
        ...fields,
      })
    }

    return NextResponse.redirect(`${origin}/panel?connected=kick`)
  } catch (err) {
    console.error('Sortea Kick auth error:', err)
    return NextResponse.redirect(`${origin}/panel?error=unknown`)
  }
}
