import { NextResponse, type NextRequest } from 'next/server'
import { verifyKickSignature } from '@/lib/kick'
import { findTenant, handleChatMessage } from '@/lib/chat'

export const runtime = 'nodejs'      // crypto + service role
export const dynamic = 'force-dynamic'

/**
 * Webhook único de Kick. La app manda todos los eventos acá, así que se rutea
 * por `broadcaster.user_id` al streamer correspondiente.
 */
export async function POST(request: NextRequest) {
  try {
    const raw       = await request.text()
    const messageId = request.headers.get('kick-event-message-id')
    const timestamp = request.headers.get('kick-event-message-timestamp')
    const signature = request.headers.get('kick-event-signature')
    const eventType = request.headers.get('kick-event-type')

    if (!messageId || !timestamp || !signature) {
      return NextResponse.json({ ok: true })   // ping/prueba manual
    }
    if (!(await verifyKickSignature(messageId, timestamp, raw, signature))) {
      console.warn('Kick webhook: firma inválida')
      return NextResponse.json({ ok: true })
    }
    if (eventType !== 'chat.message.sent') {
      return NextResponse.json({ ok: true })
    }

    const payload = JSON.parse(raw)
    const tenant  = await findTenant('KICK', String(payload?.broadcaster?.user_id ?? ''))
    if (!tenant) return NextResponse.json({ ok: true })

    const senderId = payload?.sender?.user_id
    const badges   = (payload?.sender?.identity?.badges ?? []) as { type?: string }[]
    const isMod    = senderId === payload?.broadcaster?.user_id
      || badges.some(b => b?.type === 'moderator' || b?.type === 'broadcaster')

    await handleChatMessage({
      platform: 'KICK',
      tenant,
      username: String(payload?.sender?.username ?? ''),
      content:  String(payload?.content ?? ''),
      isMod,
    })
  } catch (err) {
    console.error('Kick webhook:', err)
  }

  // Siempre 200: Kick desactiva suscripciones que fallan repetido
  return NextResponse.json({ ok: true })
}
