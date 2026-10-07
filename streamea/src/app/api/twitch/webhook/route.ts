import { NextResponse, type NextRequest } from 'next/server'
import { verifyTwitchSignature } from '@/lib/twitch'
import { findTenant, handleChatMessage } from '@/lib/chat'
import { isFreshEvent } from '@/lib/cooldown'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Webhook de EventSub (reemplaza al bot IRC: no hace falta proceso permanente). */
export async function POST(request: NextRequest) {
  const raw       = await request.text()
  const messageId = request.headers.get('twitch-eventsub-message-id') ?? ''
  const timestamp = request.headers.get('twitch-eventsub-message-timestamp') ?? ''
  const signature = request.headers.get('twitch-eventsub-message-signature') ?? ''
  const msgType   = request.headers.get('twitch-eventsub-message-type') ?? ''

  if (!verifyTwitchSignature(messageId, timestamp, raw, signature)) {
    return new NextResponse('Firma inválida', { status: 403 })
  }
  if (!messageId || !isFreshEvent(timestamp)) {
    return new NextResponse('Evento vencido o incompleto', { status: 403 })
  }

  const body = JSON.parse(raw)

  // 1) Alta de la suscripción: hay que devolver el challenge en texto plano
  if (msgType === 'webhook_callback_verification') {
    return new NextResponse(body.challenge, {
      status:  200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 2) Twitch avisa cuando revoca una suscripción (token vencido, canal baneado, etc.)
  if (msgType === 'revocation') {
    console.warn('Twitch revocó una suscripción:', body?.subscription?.status)
    return new NextResponse(null, { status: 204 })
  }

  try {
    if (body?.subscription?.type === 'channel.chat.message') {
      const event  = body.event
      const tenant = await findTenant('TWITCH', String(event?.broadcaster_user_id ?? ''))

      if (tenant) {
        const badges = (event?.badges ?? []) as { set_id?: string }[]
        const isMod  = event?.chatter_user_id === event?.broadcaster_user_id
          || badges.some(b => b?.set_id === 'moderator' || b?.set_id === 'broadcaster')

        await handleChatMessage({
          messageId,
          platform: 'TWITCH',
          tenant,
          username: String(event?.chatter_user_login ?? ''),
          content:  String(event?.message?.text ?? ''),
          isMod,
        })
      }
    }
  } catch (err) {
    console.error('Twitch webhook:', err)
  }

  return new NextResponse(null, { status: 204 })
}
