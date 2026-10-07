'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { encryptSocialConfig, validateSocialConfig, type SocialConfig } from '@/lib/social-destinations'

async function owner() {
  const client = await createSupabaseServer()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await client.from('st_streamers').select('id').eq('user_id', user.id).maybeSingle()
  if (!data) redirect('/panel')
  return data.id as string
}
function done(result: string): never {
  revalidatePath('/panel/destinos'); revalidatePath('/panel/avisos')
  redirect(`/panel/destinos?result=${result}`)
}
export async function saveDestination(form: FormData) {
  const streamerId = await owner()
  const platform = String(form.get('platform') ?? '')
  if (!['DISCORD','TELEGRAM'].includes(platform)) done('invalid')
  const config: SocialConfig = platform === 'DISCORD'
    ? { platform: 'DISCORD', webhook: String(form.get('webhook') ?? '').trim() }
    : { platform: 'TELEGRAM', token: String(form.get('token') ?? '').trim(), chatId: String(form.get('chat_id') ?? '').trim() }
  if (!validateSocialConfig(config)) done('invalid')
  let encrypted: string
  try { encrypted = encryptSocialConfig(streamerId, config) } catch { done('failed') }
  const admin = createSupabaseAdmin()
  // Cambiar el destino exige volver a activar sus avisos individualmente.
  const { error: pauseError } = await admin.from('st_announcements').update({ is_active: false })
    .eq('streamer_id', streamerId).eq('platform', platform)
  if (pauseError) done('failed')
  const { error } = await admin.from('st_social_destinations').upsert({ streamer_id: streamerId,
    platform, encrypted_config: encrypted, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'streamer_id,platform' })
  done(error ? 'failed' : 'saved')
}
export async function toggleDestination(form: FormData) {
  const streamerId = await owner()
  const platform = String(form.get('platform') ?? '')
  if (!['DISCORD','TELEGRAM'].includes(platform)) done('invalid')
  const { data, error } = await createSupabaseAdmin().from('st_social_destinations')
    .update({ is_active: form.get('enable') === 'true', updated_at: new Date().toISOString() })
    .eq('streamer_id', streamerId).eq('platform', platform).select('platform').maybeSingle()
  done(error || !data ? 'failed' : 'updated')
}
