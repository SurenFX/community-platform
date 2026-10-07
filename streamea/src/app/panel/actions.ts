'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { say, type Platform } from '@/lib/chat'
import { ensureKickSubscriptions } from '@/lib/kick'
import { ensureTwitchSubscription, makeBotModerator as helixMakeBotMod } from '@/lib/twitch'

interface Streamer {
  id:             string
  kick_user_id:   string | null
  kick_slug:      string | null
  twitch_user_id: string | null
  twitch_login:   string | null
}

async function requireStreamer(): Promise<Streamer> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión')

  const { data } = await supabase
    .from('st_streamers')
    .select('id, kick_user_id, kick_slug, twitch_user_id, twitch_login')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) throw new Error('Conectá tu cuenta primero')
  return data as Streamer
}

/** El estado del sorteo se conserva aunque falle el anuncio en el chat. */
async function botSay(streamer: Streamer, message: string, platform: Platform = 'KICK') {
  const broadcasterId = platform === 'KICK' ? streamer.kick_user_id : streamer.twitch_user_id
  if (!broadcasterId) return false

  try {
    return await say(platform, broadcasterId, message)
  } catch {
    return false
  }
}

/** Agrega el bot como moderador en Twitch y activa la lectura del chat. */
export async function makeBotModerator() {
  const streamer = await requireStreamer()
  if (!streamer.twitch_user_id) return

  const result = await helixMakeBotMod(streamer.id, streamer.twitch_user_id)
  // Con el bot ya moderador, Twitch permite suscribir el chat via EventSub
  if (result.ok) await ensureTwitchSubscription(streamer.twitch_user_id)

  revalidatePath('/panel')
}

/** Reintenta activar el bot en los chats conectados (si algo quedó a medias). */
export async function activateBot() {
  const streamer = await requireStreamer()
  const results: boolean[] = []
  try {
    if (streamer.kick_user_id) results.push(await ensureKickSubscriptions(streamer.kick_user_id))
    if (streamer.twitch_user_id) results.push(await ensureTwitchSubscription(streamer.twitch_user_id))
  } catch (err) {
    console.warn('No se pudo activar el bot:', err)
    results.push(false)
  }
  revalidatePath('/panel')
  redirect(`/panel?bot=${results.length > 0 && results.every(Boolean) ? 'subscribed' : 'failed'}`)
}

// --- Sorteos ---

function raffleResult(result: string): never {
  revalidatePath('/panel/sorteos')
  redirect(`/panel/sorteos?result=${result}`)
}

export async function startRaffle(formData: FormData) {
  const keyword  = String(formData.get('keyword') ?? '').trim()
  const platform = String(formData.get('platform') ?? 'KICK')
  if (!keyword || keyword.length > 40 || /\s/.test(keyword) || !['KICK', 'TWITCH'].includes(platform)) raffleResult('invalid')

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  const { data, error } = await admin.rpc('st_open_raffle', {
    p_streamer_id: streamer.id, p_platform: platform, p_keyword: keyword,
  })
  if (error || !data?.length) raffleResult('failed')

  const announced = await botSay(
    streamer,
    `Sorteo abierto! Escribi "${keyword}" en el chat para participar.`,
    platform as Platform,
  )
  raffleResult(announced ? 'opened' : 'opened_quiet')
}

export async function closeRaffle(formData: FormData) {
  const raffleId = String(formData.get('raffleId') ?? '')
  if (!raffleId) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  const { data, error } = await admin
    .from('st_raffles')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', raffleId)
    .eq('streamer_id', streamer.id)
    .eq('status', 'active')
    .select('id').maybeSingle()
  raffleResult(error || !data ? 'unavailable' : 'closed')
}

export async function drawWinner(formData: FormData) {
  const raffleId = String(formData.get('raffleId') ?? '')
  if (!raffleId) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  // El ID del dueño viene de la sesión, nunca del formulario.
  const { data, error } = await admin.rpc('st_draw_raffle', {
    p_streamer_id: streamer.id, p_raffle_id: raffleId,
  })
  if (error) raffleResult('failed')
  const result = data?.[0] as { winner: string; platform: Platform } | undefined
  if (!result) raffleResult('unavailable')
  const announced = await botSay(streamer, `@${result.winner} gano el sorteo! Felicitaciones!`, result.platform)
  raffleResult(announced ? 'drawn' : 'drawn_quiet')
}

export async function deleteRaffle(formData: FormData) {
  const raffleId = String(formData.get('raffleId') ?? '')
  if (!raffleId) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  await admin
    .from('st_raffles')
    .delete()
    .eq('id', raffleId)
    .eq('streamer_id', streamer.id)
    .neq('status', 'active')

  revalidatePath('/panel/sorteos')
}

// --- Comandos ---

function commandResult(result: string): never {
  revalidatePath('/panel/comandos')
  redirect(`/panel/comandos?result=${result}`)
}

export async function saveCommand(formData: FormData) {
  let command    = String(formData.get('command') ?? '').trim().toLowerCase()
  const response = String(formData.get('response') ?? '').trim()
  if (!command.startsWith('!')) command = `!${command}`
  const cooldown = Number(formData.get('cooldown_seconds') ?? 30)
  if (!/^![\p{L}\p{N}_-]{1,29}$/u.test(command) || ['!addcom','!delcom'].includes(command)
    || !response || [...response].length > 480 || !Number.isInteger(cooldown) || cooldown < 5 || cooldown > 3600) commandResult('invalid')

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  const { error } = await admin
    .from('st_commands')
    .upsert(
      { streamer_id: streamer.id, command, response, cooldown_seconds: cooldown },
      { onConflict: 'streamer_id,command' }
    )

  commandResult(error ? 'failed' : 'saved')
}

export async function toggleCommand(formData: FormData) {
  const streamer = await requireStreamer()
  const { data, error } = await createSupabaseAdmin().from('st_commands')
    .update({ is_active: formData.get('enable') === 'true' })
    .eq('id', String(formData.get('id') ?? '')).eq('streamer_id', streamer.id)
    .select('id').maybeSingle()
  commandResult(error || !data ? 'failed' : 'updated')
}

export async function deleteCommand(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  const { data, error } = await admin
    .from('st_commands')
    .delete()
    .eq('id', id)
    .eq('streamer_id', streamer.id)
    .select('id').maybeSingle()
  commandResult(error || !data ? 'failed' : 'deleted')
}
