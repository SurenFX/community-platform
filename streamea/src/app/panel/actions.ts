'use server'

import { revalidatePath } from 'next/cache'
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

/** El bot dice algo en el chat del streamer. Silencioso si falla. */
async function botSay(streamer: Streamer, message: string, platform: Platform = 'KICK') {
  const broadcasterId = platform === 'KICK' ? streamer.kick_user_id : streamer.twitch_user_id
  if (!broadcasterId) return

  try {
    await say(platform, broadcasterId, message)
  } catch {
    /* el sorteo funciona igual sin el anuncio en el chat */
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

  if (streamer.kick_user_id)   await ensureKickSubscriptions(streamer.kick_user_id)
  if (streamer.twitch_user_id) await ensureTwitchSubscription(streamer.twitch_user_id)

  revalidatePath('/panel')
}

// --- Sorteos ---

export async function startRaffle(formData: FormData) {
  const keyword  = String(formData.get('keyword') ?? '').trim()
  const platform = String(formData.get('platform') ?? 'KICK') === 'TWITCH' ? 'TWITCH' : 'KICK'
  if (!keyword) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  // Cierra cualquier sorteo abierto antes de abrir el nuevo
  await admin
    .from('st_raffles')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('streamer_id', streamer.id)
    .eq('status', 'active')

  await admin.from('st_raffles').insert({
    streamer_id: streamer.id,
    platform,
    keyword,
    status:      'active',
  })

  await botSay(
    streamer,
    `Sorteo abierto! Escribi "${keyword}" en el chat para participar.`,
    platform,
  )
  revalidatePath('/panel/sorteos')
}

export async function closeRaffle(formData: FormData) {
  const raffleId = String(formData.get('raffleId') ?? '')
  if (!raffleId) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  await admin
    .from('st_raffles')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', raffleId)
    .eq('streamer_id', streamer.id)

  revalidatePath('/panel/sorteos')
}

export async function drawWinner(formData: FormData) {
  const raffleId = String(formData.get('raffleId') ?? '')
  if (!raffleId) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  const { data: entries } = await admin
    .from('st_raffle_entries')
    .select('username')
    .eq('raffle_id', raffleId)

  const list = (entries ?? []) as { username: string }[]
  if (list.length === 0) return

  const winner = list[Math.floor(Math.random() * list.length)].username

  const { data: raffle } = await admin
    .from('st_raffles')
    .select('platform')
    .eq('id', raffleId)
    .maybeSingle()

  await admin
    .from('st_raffles')
    .update({ status: 'drawn', winner, closed_at: new Date().toISOString() })
    .eq('id', raffleId)
    .eq('streamer_id', streamer.id)

  const platform = (raffle as any)?.platform === 'TWITCH' ? 'TWITCH' : 'KICK'
  await botSay(streamer, `@${winner} gano el sorteo! Felicitaciones!`, platform)
  revalidatePath('/panel/sorteos')
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

  revalidatePath('/panel/sorteos')
}

// --- Comandos ---

export async function saveCommand(formData: FormData) {
  let command    = String(formData.get('command') ?? '').trim().toLowerCase()
  const response = String(formData.get('response') ?? '').trim()
  if (!command || !response) return
  if (!command.startsWith('!')) command = `!${command}`

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  await admin
    .from('st_commands')
    .upsert(
      { streamer_id: streamer.id, command, response },
      { onConflict: 'streamer_id,command' }
    )

  revalidatePath('/panel/comandos')
}

export async function deleteCommand(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const streamer = await requireStreamer()
  const admin    = createSupabaseAdmin()

  await admin
    .from('st_commands')
    .delete()
    .eq('id', id)
    .eq('streamer_id', streamer.id)

  revalidatePath('/panel/comandos')
}
