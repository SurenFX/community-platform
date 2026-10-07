import { createSupabaseAdmin } from './supabase/admin'
import { sendKickChat } from './kick'
import { sendTwitchChat } from './twitch'
import { sendSocialMessage } from './social-destinations'

/** Se llama una vez por evento de chat aceptado, después de deduplicarlo. */
export async function handleAnnouncement(streamerId: string, broadcasterId: string, platform: 'KICK' | 'TWITCH' | 'DISCORD' | 'TELEGRAM' = 'KICK'): Promise<void> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin.rpc('st_claim_announcement', {
    p_streamer_id: streamerId, p_platform: platform,
  })
  if (error) {
    console.warn('No se pudo reservar un aviso:', error.message)
    return
  }
  const notice = data?.[0] as { id: string; message: string } | undefined
  if (!notice) return
  // Respeta una pausa realizada después de reservar el turno.
  const { data: active, error: readError } = await admin.from('st_announcements')
    .select('is_active').eq('id', notice.id).eq('streamer_id', streamerId).maybeSingle()
  if (readError || !active?.is_active) return
  const sent = platform === 'DISCORD' || platform === 'TELEGRAM'
    ? await sendSocialMessage(streamerId, platform, notice.message)
    : await (platform === 'KICK' ? sendKickChat : sendTwitchChat)(broadcasterId, notice.message)
  if (!sent) return
  const { error: saveError } = await admin.from('st_announcements')
    .update({ last_sent_at: new Date().toISOString() }).eq('id', notice.id).eq('streamer_id', streamerId)
  if (saveError) console.warn('No se pudo registrar el envío del aviso:', saveError.message)
}
