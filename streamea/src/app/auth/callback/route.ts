import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

// Callback del magic link: intercambia el code por una sesión
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/panel`)
  }

  return NextResponse.redirect(`${origin}/login`)
}
