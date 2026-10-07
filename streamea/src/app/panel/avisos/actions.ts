'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

async function owner() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: streamer } = await supabase.from('st_streamers')
    .select('id,kick_user_id,twitch_user_id').eq('user_id', user.id).maybeSingle()
  if (!streamer) redirect('/panel')
  return { supabase, streamer }
}

function done(result: string): never {
  revalidatePath('/panel/avisos')
  redirect(`/panel/avisos?result=${result}`)
}

async function connected(streamer: Awaited<ReturnType<typeof owner>>['streamer'], platform: string) {
  if (platform === 'KICK') return Boolean(streamer.kick_user_id)
  if (platform === 'TWITCH') return Boolean(streamer.twitch_user_id)
  if (!['DISCORD','TELEGRAM'].includes(platform)) return false
  const { data, error } = await createSupabaseAdmin().from('st_social_destinations')
    .select('is_active').eq('streamer_id', streamer.id).eq('platform', platform).maybeSingle()
  return !error && data?.is_active === true
}

export async function saveAnnouncement(form: FormData) {
  const message = String(form.get('message') ?? '').trim()
  const interval = Number(form.get('interval_minutes'))
  const minimum = Number(form.get('min_messages'))
  if (!message || [...message].length > 400 || !Number.isInteger(interval) || interval < 5 || interval > 1440
    || !Number.isInteger(minimum) || minimum < 5 || minimum > 100) done('invalid')
  const { supabase, streamer } = await owner()
  const platform = String(form.get('platform') ?? '')
  if (!['KICK', 'TWITCH', 'DISCORD', 'TELEGRAM'].includes(platform)) done('invalid')
  if (!(await connected(streamer, platform))) done('connect')
  const id = String(form.get('id') ?? '')
  const fields = { platform, message, interval_minutes: interval, min_messages: minimum,
    is_active: false, message_count: 0, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  if (id) {
    const { data, error } = await supabase.from('st_announcements').update(fields)
      .eq('id', id).eq('streamer_id', streamer.id).select('id').maybeSingle()
    done(error || !data ? 'error' : 'saved')
  }
  const { count, error: countError } = await supabase.from('st_announcements')
    .select('id', { count: 'exact', head: true }).eq('streamer_id', streamer.id)
  if (countError) done('error')
  if ((count ?? 0) >= 10) done('limit')
  const { error } = await supabase.from('st_announcements').insert({ ...fields, streamer_id: streamer.id })
  done(error ? 'error' : 'saved')
}

export async function toggleAnnouncement(form: FormData) {
  const { supabase, streamer } = await owner()
  const id = String(form.get('id') ?? '')
  const enabled = form.get('enable') === 'true'
  if (enabled) {
    const { data: notice, error: readError } = await supabase.from('st_announcements')
      .select('platform').eq('id', id).eq('streamer_id', streamer.id).maybeSingle()
    if (readError || !notice) done('error')
    if (!(await connected(streamer, notice.platform))) done('connect')
  }
  const { data, error } = await supabase.from('st_announcements').update({
    is_active: enabled, message_count: 0, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id).eq('streamer_id', streamer.id).select('id').maybeSingle()
  done(error || !data ? 'error' : enabled ? 'enabled' : 'paused')
}
