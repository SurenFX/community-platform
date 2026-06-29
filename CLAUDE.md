# Community Platform — Bitácora del proyecto

> **Para Claude**: leé este archivo completo al empezar cualquier sesión nueva sobre este
> proyecto, antes de tocar código. Te da el contexto que normalmente se pierde al cortar
> una conversación por límite de longitud. Mantenelo actualizado: cada vez que termines
> una tarea no trivial, agregá una línea a la sección "Historial" y actualizá "Estado
> actual" / "Pendientes" si corresponde. No es opcional — es la única memoria persistente
> entre conversaciones distintas.

## Qué es esto

Hub de engagement y reputación (gamificación) para la comunidad de un streamer
(SalchiNFT — Twitch/Kick/YouTube/Discord/Telegram). Los miembros ganan XP y SalchiCoins
por participar (mensajes, reacciones, comentarios, ver el stream, etc.), suben de nivel,
desbloquean badges/cosméticos, compiten en un leaderboard, completan misiones y desafíos,
y participan en sorteos en vivo durante los streams.

## Stack y arquitectura

- **`app/`** — Next.js 15 + TypeScript + Tailwind. Frontend público + dashboard + admin.
  Desplegado en **Vercel** (proyecto `community-platform-app`, team
  `community-platform-s-projects`).
- **`worker/`** — NestJS. Bots de Discord/Telegram, integraciones con Twitch/YouTube/Kick,
  cron jobs (misiones, temporadas, XP, anuncios), webhooks. Desplegado en **Fly.io**
  (app `worker-marbled-acorn-591`, región `gru`).
- **Supabase** — Postgres + Auth (Discord OAuth) + Realtime. Migraciones en
  `supabase/migrations/`, se aplican a mano desde el SQL Editor de Supabase (no hay
  `supabase db push` automatizado en este flujo).
- **Upstash Redis** — cache, dedup (locks `setNX`), y ahora también para persistir IDs de
  mensajes "reemplazables" (ver Recruitment más abajo).
- Repo: `github.com/SurenFX/community-platform` — **es público** (Vercel Hobby no soporta
  colaboración en repos privados con múltiples autores de commit; lo pasamos a público).

## Cómo desplegar

- **Frontend (Vercel)**: cualquier push a `main` dispara el deploy automáticamente —
  **pero solo si el push lo hace el dueño de la cuenta de GitHub/Vercel** (`pauli`/`Salchi`
  con su propio git, no desde un agente/sandbox con otras credenciales). Si un deploy
  aparece "Blocked" en el dashboard de Vercel, la solución es que el usuario haga
  `git commit --allow-empty -m "trigger deploy" && git push` desde su propia terminal, o
  usar `vercel --prod` con la CLI (requiere `vercel login` una vez). Importante: correr
  `vercel` desde la raíz del repo, no desde `app/` (el root directory ya está configurado
  como `app` en el proyecto de Vercel).
- **Worker (Fly.io)**: `fly deploy --app worker-marbled-acorn-591` desde `worker/`.
  Las env vars se manejan con `fly secrets set KEY=value --app worker-marbled-acorn-591`
  (no hace falta `fly deploy` después de un `secrets set`, Fly reinicia solo). El usuario
  corre estos comandos en su propia terminal porque la sandbox de la IA no tiene `fly` CLI
  ni acceso de red a `id.kick.com` / Supabase / etc. (proxy con allowlist).

## Variables de entorno (worker/.env — gitignored, nunca commitear valores)

Secciones existentes: `SUPABASE_*`, `UPSTASH_REDIS_REST_*`, `DISCORD_BOT_TOKEN`,
`DISCORD_GUILD_ID`, `WORKER_SECRET`, `PORT`, `YOUTUBE_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_GROUP_ID`, `DISCORD_TWITCH_CHANNEL_ID`, `DISCORD_YOUTUBE_CHANNEL_ID`,
`DISCORD_SESAME_TRIGGER_CHANNEL_ID`, `DISCORD_SESAME_TARGET_CHANNEL_ID`,
`KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, `KICK_CHANNEL_SLUG`,
`DISCORD_RECRUITMENT_CHANNEL_ID`, `TELEGRAM_RECRUITMENT_CHAT_ID`,
`TELEGRAM_RECRUITMENT_THREAD_ID`. Todas estas también deben estar seteadas como
**Fly secrets** en producción (el `.env` local es solo para referencia/dev).

## Historial (qué se hizo, en orden aproximado)

**Base / fundaciones**: schema inicial, auth Discord OAuth, motor de XP, Discord bot,
leaderboard realtime, admin panel básico.

**Integraciones sociales**: vinculación de Telegram vía deep link (`/start TOKEN`),
YouTube (suscripción + comentarios + anuncio de videos nuevos a Discord/Telegram),
Twitch (chat IRC, sorteos por keyword, detección de stream en vivo), Kick (OAuth 2.1+PKCE,
chat, sorteos por keyword, webhook de eventos).

**Gamificación core**: SalchiCoins (moneda secundaria), sistema de misiones (aceptar +
reclamar, por período diario/semanal con reset automático vía cron, filtros
stream-only), badges (incluye secretos `???` y de antigüedad), rachas/streaks con
multiplicador visual, niveles con curva aplanada + tiers + recompensas por hitos,
temporadas (banner, countdown, cierre a las 00:00 UTC, historial con top 3), shop de
cosméticos (con preview antes de comprar), desafíos comunitarios (con auto-fail cron y
distribución de recompensas), eventos de XP global (doble/triple XP).

**Frontend / UX**: rediseño de perfil como "character sheet" RPG (heatmap de actividad,
historial de nivel, battle pass, tarjeta compartible en PNG), perfil público
`/perfil/[username]`, ranking público `/ranking`, página de notificaciones con historial,
"quest board" estética taberna, podio animado top 3, hover cards en leaderboard, sidebar
responsive (hamburger drawer mobile), cosméticos visibles en perfil/leaderboard/sidebar,
título de rango visible, XP flotante en tiempo real vía Realtime.

**Admin**: gestión de temporadas, desafíos, XP/SC manual por usuario, detalle de usuario
`/admin/users/[id]`, reporte de bono diario, analytics con tablas nuevas, panel CRUD de
premios de la Rueda, ver participantes de sorteos.

**Calidad/infra**: robots.txt + sitemap, error boundaries, fixes de race conditions
(claimMission, streak bonus no aparecía en historial), N+1 queries, SEO, paginación.

**Sorteos de Kick (sesión reciente)**: migración `010_kick_raffles.sql`
(`kick_raffles`, `kick_raffle_entries`, `kick_bot_tokens`), `KickApiService` (OAuth
client_credentials para app token + authorization_code/refresh para bot token,
resolución de `broadcaster_user_id` vía slug, envío de chat, suscripción a webhook
`chat.message.sent`), `KickController` (webhook + start/stop/draw), frontend
`KickRaffle.tsx` + páginas admin/dashboard, wiring de navegación. Bugs encontrados y
arreglados en el camino:
- `ensureChatSubscription` debía usar el **App Access Token** (no el del bot) para poder
  suscribirse al canal de `KICK_CHANNEL_SLUG` sin importar qué cuenta sea el bot —
  con un user token, Kick ignora `broadcaster_user_id` y usa el canal del propio token.
- El endpoint `POST /chat` de Kick requiere el campo `type` (`'user'` o `'bot'`) — es
  obligatorio según el swagger. Con `type:'bot'` tirá 500 si la cuenta no está registrada
  como bot del canal; con `type:'user'` funciona normal (manda como la cuenta que
  autorizó el OAuth).
- El repo tuvo que pasarse a público porque Vercel Hobby bloquea deploys de repos
  privados cuando el push no viene del dueño exacto de la cuenta.

**Fix YouTube → Discord/Telegram**: `scanNewComments()` cortaba TODA la función
(incluido el aviso de video nuevo) si no había ningún usuario con YouTube vinculado en
`user_social_links`. Se separó: el aviso de videos nuevos ya no depende de tener
usuarios registrados; solo el escaneo de comentarios (que sí necesita el mapa de
usuarios) se saltea si no hay nadie vinculado.

**Recordatorio de reclutamiento**: nuevo módulo `worker/src/modules/recruitment/`.
Cron cada 4 horas (`0 */4 * * *`) que postea un mensaje fijo a un canal de Discord y a
un chat/tema de Telegram. Antes de mandar el mensaje nuevo, borra el anterior (guarda el
`message_id` en Redis por plataforma — `recruitment:discord:last_msg_id` /
`recruitment:telegram:last_msg_id` — y solo borra ESE mensaje puntual, nunca el último
mensaje del canal en general). En Telegram usa un `chat_id` explícito
(`TELEGRAM_RECRUITMENT_CHAT_ID`, derivado del link `https://t.me/c/<id>/<thread>` como
`-100<id>`) en vez de depender de `TELEGRAM_GROUP_ID`, para poder apuntar a un grupo/tema
distinto sin afectar el resto de los anuncios.

**Misiones, badges y XP de Kick (chat/follow/sub)**: extendido el mismo sistema de
gamificación que ya existía para Twitch, ahora también para Kick.
- Migración `011_kick_xp_enum.sql`: agrega `KICK_CHAT_MESSAGE`, `KICK_FOLLOW`,
  `KICK_SUBSCRIBE` al enum `xp_event_type`. **Va en archivo separado** de
  `012_kick_missions_badges_seed.sql` (que sí usa esos valores) porque Postgres no
  permite usar un valor de enum recién agregado dentro de la misma transacción en la
  que se agregó — hay que correr 011 y esperar que termine antes de correr 012.
- Migración `012`: `xp_config` (base_xp 8/100/500, mismos montos que Twitch
  chat/follow/sub) + 7 misiones (4 tiers de chat, follow, 2 tiers de sub) + 5 badges
  con `family='kick'`.
- Worker: `KickApiService.ensureChatSubscription` ahora suscribe también
  `channel.followed` y `channel.subscription.new/renewal` (antes solo
  `chat.message.sent`). `KickController` otorga XP en cada mensaje de chat (no solo
  el de la keyword del sorteo), cada follow y cada sub, resolviendo el `discord_id`
  vía `user_social_links` (`platform='KICK'`, `external_id` = user_id numérico de
  Kick — no el username, para evitar problemas de mayúsculas/cambios de nombre).
- `xp-calculator.service.ts`: agregado `'KICK'` a `SocialPlatform` y los 3 event
  types nuevos a `XpEventType`, multiplier 1.2 (igual que Twitch).
- **Nuevo**: flujo OAuth 2.1+PKCE para que cualquier USUARIO (no el bot) vincule su
  propia cuenta de Kick desde `/dashboard/configuracion` — `/auth/kick/start` genera
  el par PKCE + `state`, los guarda en cookies httpOnly de 10 min, y redirige a Kick;
  `/auth/kick` es el callback que intercambia el `code`, llama `GET /public/v1/users`
  (con el token del usuario) para obtener su `user_id`/`name`, y hace upsert en
  `user_social_links`. Requiere agregar `KICK_CLIENT_ID`/`KICK_CLIENT_SECRET` también
  como env vars del proyecto de **Vercel** (no solo del worker), y registrar
  `https://<dominio>/auth/kick` como redirect URI adicional en el Developer App de Kick.
- Se actualizaron los 8 archivos del frontend que tienen diccionarios `EVENT_LABELS`
  duplicados (deuda técnica preexistente, no centralizados) más `FAMILY_LABELS` en
  `BadgesClient.tsx` — mismo patrón repetitivo que ya se había dado con Telegram
  (ver tarea #13 del historial de tareas).

**Anuncios de Kick en vivo (Discord/Telegram)**: `KickApiService.checkStreamLive()` detecta
transición offline→online y postea embed en Discord (color 0x53FC18) + mensaje en Telegram
al mismo canal que Twitch. Dedup con `redis.setNX('kick:live:{slug}', '1', 2h)`. Refresca
`kick:stream_active` en Redis (TTL 5 min) para cross-platform awareness.

**YouTube → chat de Twitch y Kick (con lógica de lives)**:
- Videos del día en adelante se anuncian en chat de Twitch y Kick durante el live, una vez
  por hora (`yt:chat_last:{id}` TTL 48h). Al terminar el live, si ya se anunció, se marca
  con `yt:chat_done:{id}` (30 días) para que el próximo live no lo vuelva a mencionar.
- `YoutubeModule` importa `TwitchModule` y `KickModule` para poder llamar
  `twitchIrc.sendChat()` y `kickApi.sendChat()` sin circular dependency.

**Cross-promo Twitch→Kick**: `TwitchIrcService.remindKickInChat()` cron cada 30 min.
Solo se activa si `this.isLive` (Twitch) y `kick:stream_active` (Redis key con TTL 5 min)
ambos están activos. Dedup con `redis.setNX('cross:kick_reminder_in_twitch', '1', 30m)`.
Solo una dirección: Twitch chat menciona Kick, no viceversa.

**Sistema de referidos (afiliados)**: nuevo feature para mostrar links de referido de juegos.
- Migración `013_referral_links.sql`: tabla `referral_links` con RLS (solo admins escriben,
  usuarios autenticados leen los activos).
- Admin `/admin/referidos`: CRUD completo con formulario modal, preview de imagen del juego,
  contador de clics, toggle activo/inactivo, orden personalizable.
- Dashboard `/dashboard/referidos`: grid de cards estilo poster de juego (aspect-ratio 3:4),
  imagen full con gradiente overlay, hover con scale + glow border + descripción + botón
  "Jugar con referido". Click trackea en DB (`click_count`) y abre URL en nueva pestaña.
- Server actions: `createReferralLink`, `updateReferralLink`, `deleteReferralLink`,
  `trackReferralClick` en `app/actions/admin.ts`.
- Sidebar + AdminSidebar: entrada "Referidos" con ícono `Gamepad2`.

**Discord bot — onboarding, level-up, comandos**:
- `discord-bot.service.ts` reescrito (heredoc, por stale mount repetido):
- `TELEGRAM_GROUP_ID` fijado a `-1002155732770` (derivado de `t.me/c/2155732770/1`).
- Onboarding embed en `#verificar` (`DISCORD_ONBOARDING_CHANNEL_ID=1267645951376494727`):
  embed con texto completo (beta warning, descripción del hub, reglas), 3 botones en una
  sola fila (Verificarme / Ir al Hub / Mis misiones), msg_id persistido en Redis
  (`discord:onboarding:msg_id`) para editar en lugar de repostear.
- Botón "Verificarme" asigna el rol `DISCORD_VERIFIED_ROLE_ID` (928400272563269713)
  via `handleVerifyButton()`, respuesta ephemeral.
- Level-up: `handleLevelUp()` anuncia en `DISCORD_LEVELUP_CHANNEL_ID` (1521293359845740736)
  con embed verde + tier del usuario (Viewer/Regular/Core/Élite/Leyenda).
- Comandos `!rank`, `!xp`, `!misiones` solo en `DISCORD_COMMANDS_CHANNEL_ID` (mismo canal).
  `!rank` / `!xp`: embed con nivel, tier, XP, rank global, SC y racha.
  `!misiones`: lista de misiones aceptadas con barras de progreso.
- YouTube: filtrado de lives/scheduled (`liveBroadcastContent !== 'none'`) ANTES del filtro
  de VODs, para no anunciar streams en vivo como videos nuevos.
- `014_streak_badges.sql`: 4 badges de racha (streak_7 BRONZE / streak_30 SILVER /
  streak_60 GOLD / streak_100 LEGENDARY). Se otorgan en `claimDailyBonus()` exactamente
  el día que `newStreak` toca el hito, con notificación `BADGE_EARNED`.
- Nuevas env vars (worker): `DISCORD_LEVELUP_CHANNEL_ID`, `DISCORD_COMMANDS_CHANNEL_ID`,
  `DISCORD_ONBOARDING_CHANNEL_ID`, `DISCORD_VERIFIED_ROLE_ID`.

## Estado actual

Plataforma funcionalmente muy completa (ver Historial). `tsc --noEmit` limpio en
`app/` y `worker/` (hay ~60 errores preexistentes en `app/` no relacionados a este
trabajo, documentados como deuda técnica fuera de alcance). Worker corriendo en Fly.io
con todos los módulos activos (Discord, Telegram, YouTube, Twitch, Kick, Recruitment).

## Pendientes (no bloqueantes)

- Cosméticos visibles en el avatar del sidebar (actualmente sí en perfil/leaderboard).
- Push notifications (level-up, misión completada, nuevo desafío) — hoy solo hay
  notificaciones in-app + Realtime, no push del navegador/móvil.
- Antes de un onboarding masivo: probar a mano los flujos críticos end-to-end (login,
  conectar redes, reclamar misión, subir de nivel, entrar a un sorteo, perfil en mobile).
- **Worker deploy pendiente**: correr `fly deploy --app worker-marbled-acorn-591` desde
  `worker/` para activar: onboarding embed Discord, level-up channel, bot commands,
  anuncios de Kick en vivo, YouTube→chat, cross-promo Twitch→Kick.
- **Setup manual pendiente para que funcione el OAuth de Kick de usuarios** (código ya
  pusheado, falta configuración externa):
  1. Correr `013_referral_links.sql` en el SQL Editor de Supabase.
  2. Correr `011_kick_xp_enum.sql` en el SQL Editor de Supabase, esperar que termine,
     y RECIÉN AHÍ correr `012_kick_missions_badges_seed.sql` (en otra ejecución separada).
  3. Agregar `https://<dominio de Vercel>/auth/kick` como redirect URI en el Developer
     App de Kick (el mismo Client ID/Secret que ya usa el bot).
  4. Agregar `KICK_CLIENT_ID` y `KICK_CLIENT_SECRET` como env vars del proyecto de
     **Vercel** (Settings → Environment Variables del proyecto `community-platform-app`) —
     hoy solo están seteadas como Fly secrets del worker, el frontend necesita su copia.

## Gotchas