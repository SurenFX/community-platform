# Eventos detectables por plataforma

Referencia para diseño de misiones y actividades de la Community Platform.  
✅ = ya implementado | 🔲 = posible, no implementado aún | ⚠️ = requiere configuración adicional

---

## TWITCH

### Vía IRC (conexión actual)

| Evento | Código evento | Estado | Notas |
|--------|--------------|--------|-------|
| Mensaje en el chat | `TWITCH_CHAT_MESSAGE` | ✅ | XP por cada msg durante stream |
| Suscripción nueva (sub) | `TWITCH_SUBSCRIBE` | ✅ | Detectado via USERNOTICE msg-id=sub |
| Resuscripción (resub) | `TWITCH_SUBSCRIBE` | ✅ | USERNOTICE msg-id=resub, dedup mensual |
| Gift sub (envía) | `TWITCH_GIFT_SUB` | ✅ | USERNOTICE msg-id=subgift |
| Gift sub masivo | `TWITCH_GIFT_SUB` | ✅ | USERNOTICE msg-id=submysterygift |
| Primero en saludar | bonus FIRST_GREETER | ✅ | +100 XP +50 SC, Redis dedup por stream |
| Keyword de sorteo | raffle entry | ✅ | Detecta palabra clave de rifa activa |
| Watch time (10 min) | `TWITCH_WATCH_TIME` | ✅ | Cron cada 10 min durante stream |

### Vía EventSub (webhooks — requieren setup adicional)

Requieren registrar endpoint en Twitch y usuario/canal broadcaster como condición.

| Evento EventSub | Evento propuesto | Estado | Notas |
|----------------|-----------------|--------|-------|
| `channel.follow` | `TWITCH_FOLLOW` | 🔲⚠️ | Requiere user token con `moderator:read:followers`. Misión: Seguir el canal |
| `channel.cheer` | `TWITCH_CHEER` | 🔲⚠️ | Bits donados. Escalar por cantidad de bits |
| `channel.raid` | `TWITCH_RAID_SEND` | 🔲⚠️ | Cuando el canal raideó a otro. Misión: hacer raid |
| `channel.raid` (inbound) | `TWITCH_RAID_RECEIVE` | 🔲⚠️ | Cuando alguien raideó el canal. Actividad general |
| `channel.vip.add` | `TWITCH_VIP_EARNED` | 🔲⚠️ | Usuario recibió VIP. Logro especial |
| `channel.moderator.add` | `TWITCH_MOD_EARNED` | 🔲⚠️ | Usuario recibió mod. Logro especial |
| `channel.channel_points_custom_reward_redemption.add` | `TWITCH_REDEEM` | 🔲⚠️ | Canje de channel points. Misión: canjear X veces |
| `channel.poll.end` | `TWITCH_POLL_VOTE` | 🔲⚠️ | Votar en una encuesta del canal |
| `channel.prediction.end` | `TWITCH_PREDICTION_WIN` | 🔲⚠️ | Ganar una predicción |
| `channel.hype_train.begin` | `TWITCH_HYPE_TRAIN` | 🔲⚠️ | Participar en hype train |
| `channel.shoutout.receive` | `TWITCH_SHOUTOUT` | 🔲⚠️ | El canal recibió un shoutout |
| `channel.charity_campaign.donate` | `TWITCH_CHARITY_DONATE` | 🔲⚠️ | Donación a campaña de caridad |
| `channel.ban` | — | 🔲 | Ban/timeout de usuario. Para moderación, no XP |
| `stream.online` | announce | ✅ | Anuncia en Discord y Telegram General |
| `stream.offline` | — | 🔲 | Podría dar XP de "estuvo en stream completo" |
| `channel.ad_break.begin` | — | 🔲 | Ad break iniciado. Sin uso directo de XP |

### Misiones Twitch sugeridas (no implementadas)

- **Seguir el canal** → `TWITCH_FOLLOW` (1 vez, 100 XP)
- **Donar bits** → `TWITCH_CHEER` (escalado: 100 bits = 200 XP, 1000 bits = 1000 XP)
- **Primer raid** / **Raider habitual** → `TWITCH_RAID_SEND` (ya está en seed, falta implementar)
- **Canjear channel points** → `TWITCH_REDEEM` (1 canje, 5 canjes, 20 canjes)
- **Ganar una predicción** → `TWITCH_PREDICTION_WIN`
- **Participar en poll** → `TWITCH_POLL_VOTE`
- **Conseguir VIP** → `TWITCH_VIP_EARNED` (logro único)

---

## DISCORD

### Vía discord.js Gateway (conexión actual)

| Evento Gateway | Evento propuesto | Estado | Notas |
|---------------|-----------------|--------|-------|
| `messageCreate` | `DISCORD_MESSAGE` | ✅ | XP por mensaje, cooldown por canal |
| `messageReactionAdd` (recibida) | `DISCORD_REACTION_RECEIVED` | ✅ | XP para el autor del mensaje |
| `messageReactionAdd` (dada) | `DISCORD_REACTION_GIVEN` | 🔲 | XP para quien reacciona |
| `guildMemberAdd` | `DISCORD_JOIN` | 🔲 | Usuario se une al servidor. Bonus de bienvenida |
| `voiceStateUpdate` | `DISCORD_VOICE_TIME` | 🔲 | Entrar/salir de canal de voz. XP por minutos |
| `guildScheduledEventUserAdd` | `DISCORD_EVENT_RSVP` | 🔲 | Usuario se apunta a evento del servidor |
| `threadCreate` | `DISCORD_THREAD_CREATE` | 🔲 | Usuario creó un hilo. Misión: crear X hilos |
| `threadMemberUpdate` | `DISCORD_THREAD_JOIN` | 🔲 | Usuario se unió a un hilo |
| `messageCreate` con attachment | `DISCORD_MEDIA_SHARE` | 🔲 | Compartir imagen/video en el chat |
| `messageCreate` con mention | `DISCORD_MENTION` | 🔲 | Mencionar a alguien (detector de interacción) |
| `inviteCreate` | `DISCORD_INVITE_CREATE` | 🔲 | Crear un link de invitación (referidos) |
| `guildMemberAdd` con inviteCode | `DISCORD_REFERRAL` | 🔲 | Alguien se unió con tu link. Requiere tracking de invites |
| `messageCreate` en canal específico | `DISCORD_INTRO_POST` | 🔲 | Presentación en canal #presentaciones |

### Misiones Discord sugeridas (no implementadas)

- **Unirse al servidor** → `DISCORD_JOIN` (1 vez, 50 XP) — detecta primer mensaje como proxy actualmente
- **Participar en evento** → `DISCORD_EVENT_RSVP` (apuntarse a X eventos)
- **Crear hilo** → `DISCORD_THREAD_CREATE` (crear 1 hilo, crear 5 hilos)
- **Tiempo en voz** → `DISCORD_VOICE_TIME` (15 min, 1 hora, 5 horas acumuladas)
- **Compartir contenido** → `DISCORD_MEDIA_SHARE` (compartir 1 imagen/video)
- **Referir miembros** → `DISCORD_REFERRAL` (1 referido, 5 referidos) — requiere tracking de invites
- **Reaccionar mensajes** → `DISCORD_REACTION_GIVEN` (dar 10, 50 reacciones)

---

## YOUTUBE

### Vía YouTube Data API v3 (polling actual)

| Evento/Acción | Evento propuesto | Estado | Notas |
|--------------|-----------------|--------|-------|
| Comentar en video del canal | `YOUTUBE_COMMENT` | ✅ | Scan cada 30 min, últimos 7 días |
| Suscribirse al canal | `YOUTUBE_SUBSCRIBE` | ✅ | Verificado al conectar cuenta |
| Primero en comentar en video nuevo | bonus FIRST_COMMENTER | ✅ | +100 XP +50 SC |
| Nuevo video publicado | announce | ✅ | Anuncia en Discord y Telegram Salchitube |
| Responder comentario | `YOUTUBE_REPLY` | 🔲 | Comentarios de tipo reply, no top-level |
| Like en video | — | ❌ | **No disponible** — YouTube API no expone likes por usuario externo |
| Live chat durante stream | `YOUTUBE_LIVE_CHAT` | 🔲⚠️ | YouTube Live Chat API, requiere polling activo del liveChatId |
| Nuevo sub verificado periódicamente | `YOUTUBE_SUBSCRIBE` | 🔲 | Re-verificar subs para usuarios que se desuscriben |
| Post en comunidad | `YOUTUBE_COMMUNITY_POST` | 🔲⚠️ | Community Posts API, requiere OAuth |

### Misiones YouTube sugeridas (no implementadas)

- **Responder a comentarios** → `YOUTUBE_REPLY` (responder 1 vez, 5 veces)
- **Comentar en X videos seguidos** → `YOUTUBE_COMMENT_STREAK` (racha de comentarios en videos consecutivos)
- **Participar en live chat** → `YOUTUBE_LIVE_CHAT` (escribir durante un stream en vivo de YouTube)

---

## TELEGRAM

### Vía Telegraf Bot API (conexión actual)

| Evento Update | Evento propuesto | Estado | Notas |
|--------------|-----------------|--------|-------|
| `message` en grupo | `TELEGRAM_MESSAGE` | ✅ | XP por mensaje en grupo |
| `chat_member` (usuario se une) | `TELEGRAM_JOIN` | 🔲 | Nuevo miembro en el grupo. Bonus de bienvenida |
| `message_reaction` | `TELEGRAM_REACTION` | 🔲 | Usuario reaccionó a un mensaje. Requiere `message_reaction` en allowed_updates |
| `poll_answer` | `TELEGRAM_POLL_VOTE` | 🔲 | Respondió una encuesta. Requiere que el bot envíe el poll |
| `chat_boost` | `TELEGRAM_BOOST` | 🔲 | Usuario boosteó el canal/grupo. Logro especial |
| `callback_query` | `TELEGRAM_BUTTON_PRESS` | 🔲 | Presionó botón inline del bot |
| `message` con sticker | `TELEGRAM_STICKER` | 🔲 | Usar sticker en el grupo |
| `message` con tipo `photo`/`video` | `TELEGRAM_MEDIA_SHARE` | 🔲 | Compartir multimedia |
| `message` en topic específico | `TELEGRAM_TOPIC_MESSAGE` | 🔲 | Mensaje en Salchitube, Clips, etc. |
| `chat_join_request` | — | 🔲 | Solicitud de unión (si el grupo es privado/aprobado) |
| `message` en thread 6763 (Salchitube) | `TELEGRAM_SALCHITUBE_MSG` | 🔲 | Participar en tópico de YouTube |

### Misiones Telegram sugeridas (no implementadas)

- **Unirse al grupo** → `TELEGRAM_JOIN` (1 vez, bonus de bienvenida, 50 XP)
- **Reaccionar a un mensaje** → `TELEGRAM_REACTION` (dar 5, 20, 100 reacciones)
- **Votar en encuesta** → `TELEGRAM_POLL_VOTE` (votar en 1 encuesta, 5 encuestas)
- **Boostear el grupo** → `TELEGRAM_BOOST` (logro único, gran recompensa)
- **Participar en Salchitube** → `TELEGRAM_TOPIC_MESSAGE` (enviar mensaje en tópico Salchitube)
- **Compartir clip/media** → `TELEGRAM_MEDIA_SHARE` (compartir 1 foto/video en el grupo)

---

## Resumen — Eventos implementados vs. disponibles

| Plataforma | Implementados | Disponibles (no impl.) |
|-----------|--------------|----------------------|
| Twitch | 8 | ~12 más via EventSub |
| Discord | 2 | ~7 más via Gateway |
| YouTube | 4 | ~3 más |
| Telegram | 1 | ~7 más |

---

## Ideas de misiones cruzadas (cross-platform)

Requieren que el usuario tenga cuentas conectadas en múltiples plataformas:

- **Ciudadano del universo** → Enviar mensaje en Discord, Twitch y Telegram en la misma semana
- **Fan total** → Suscribirse tanto a YouTube como a Twitch del canal
- **Social media star** → Comentar en YouTube y participar en el chat del stream el mismo día
- **Embajador** → Referir a alguien en Discord Y que esa persona conecte Twitch
- **Maratón** → Participar en stream de Twitch Y comentar en video de YouTube esa misma semana

---

## Notas técnicas para implementar EventSub (Twitch)

Para detectar follows, cheers, raids, etc. se necesita:

1. Registrar endpoint HTTP público en Twitch (el worker ya tiene URL en Fly.io)
2. Para algunos eventos (follow): user token con scope `moderator:read:followers`
3. Para otros (stream events): app token con broadcaster user ID

```typescript
// Ejemplo de registro de subscripción EventSub
POST https://api.twitch.tv/helix/eventsub/subscriptions
{
  "type": "channel.follow",
  "version": "2",
  "condition": {
    "broadcaster_user_id": "BROADCASTER_ID",
    "moderator_user_id": "MODERATOR_ID"
  },
  "transport": {
    "method": "webhook",
    "callback": "https://worker-marbled-acorn-591.fly.dev/twitch/eventsub",
    "secret": "WEBHOOK_SECRET"
  }
}
```

## Notas técnicas para Discord Voice Time

Para trackear tiempo en canal de voz:

```typescript
// En discord.service.ts
client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = newState.member?.id
  if (!userId) return
  
  if (!oldState.channelId && newState.channelId) {
    // Entró a canal de voz — guardar timestamp en Redis
    await redis.set(`discord:voice:${userId}`, Date.now().toString())
  }
  
  if (oldState.channelId && !newState.channelId) {
    // Salió de canal de voz — calcular duración y dar XP
    const joinedAt = await redis.get(`discord:voice:${userId}`)
    if (joinedAt) {
      const minutes = Math.floor((Date.now() - Number(joinedAt)) / 60000)
      // Dar XP por cada 10 minutos (o fracción)
      await redis.del(`discord:voice:${userId}`)
    }
  }
})
```

## Notas técnicas para Telegram chat_member

```typescript
// En telegram.service.ts — agregar a allowed_updates
bot.telegram.setMyCommands([...])
// Y en getUpdates o webhook:
allowed_updates: ['message', 'chat_member', 'message_reaction', 'chat_boost', 'poll_answer']

// Handler
bot.on('chat_member', async (ctx) => {
  const update = ctx.chatMember
  if (update.new_chat_member.status === 'member') {
    // Usuario se unió → dar bonus
  }
})
```
