'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

async function requireStreamer() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión')

  const { data } = await supabase
    .from('st_streamers')
    .select('id, kick_user_id, kick_slug')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) throw new Error('Conectá tu cuenta de Kick primero')
  return data as { id: string; kick_user_id: string | null; kick_slug: string | null }
}

/** Pide al worker que el bot diga algo en el chat del streamer. Silencioso si falla. */
async function botSay(streamerId: string, message: string, platform: 'KICK' | 'TWITCH' = 'KICK') {
  const url    = process.env.WORKER_URL
  const secret = process.env.WORKER_SECRET
  if (!url || !secret) return

  try {
    await fetch(`${url.replace(/\/$/, '')}/streamea/say`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': secret },
      body:    JSON.stringify({ streamerId, message, platform }),
    })
  } catch {
    /* el sorteo funciona igual sin el anuncio en el chat */
  }
}

/** Pide al worker que agregue el bot como moderador en Twitch (Helix). */
export async function makeBotModerator() {
  const streamer = await requireStreamer()
  const url      = process.env.WORKER_URL
  const secret   = process.env.WORKER_SECRET
  if (!url || !secret) return

  try {
    await fetch(`${url.replace(/\/$/, '')}/streamea/twitch/mod`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': secret },
      body:    JSON.stringify({ streamerId: streamer.id }),
    })
  } catch {
    /* si falla, el streamer siempre puede usar /mod a mano */
  }

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
    streamer.id,
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
  await botSay(streamer.id, `@${winner} gano el sorteo! Felicitaciones!`, platform)
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
