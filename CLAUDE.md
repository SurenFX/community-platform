# Streamea (ex Community Platform) — Bitácora del proyecto

> **SEPTIEMBRE 2026 — EL PROYECTO ES SOLO STREAMEA.** El hub de gamificación
> (`app/`), el worker de NestJS (`worker/`) y toda la infra de Google Cloud fueron
> **dados de baja** (GCP cobraba ~USD 3/mes por la IP pública). Streamea ahora corre
> 100% serverless en Vercel, gratis, sin VM ni procesos permanentes. Todo lo que
> aparece más abajo sobre el hub, la VM, PM2, bots de Discord/Telegram/YouTube e IRC
> es **historia**, se conserva solo como contexto de por qué las cosas son como son.
> Lo vigente arranca en "Streamea etapa 5 — sin servidor".


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
  cron jobs (misiones, temporadas, XP, anuncios), webhooks. Desplegado en **Google Cloud
  Free Tier** (VM e2-micro, us-central1, IP pública `34.121.74.142`, proyecto `salchineta`).
  Manejado con PM2 (autostart con systemd). Fly.io fue destruido en julio 2026 por cobros.
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
- **Worker (Google Cloud)**: SSH a la VM via consola de Google Cloud
  (console.cloud.google.com → Compute Engine → Instancias → SSH). En la VM:
  ```
  cd ~/community-platform/worker
  git pull
  npm install
  npm run build
  pm2 restart worker
  ```
  Las env vars están en `~/community-platform/worker/.env` en la VM (editar con `nano .env`).
  PM2 con systemd asegura que el worker sobreviva reinicios automáticamente.

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

**Migración Fly.io → Google Cloud + fix crítico Supabase/crons**:
- Fly.io destruido en julio 2026 por cobros inesperados. Worker migrado a Google Cloud
  Free Tier (e2-micro, us-central1, IP `34.121.74.142`, proyecto `salchineta`).
- Setup: Node.js 20, PM2 con systemd autostart, git clone, npm install, .env manual.
- Fix crítico: `@supabase/realtime-js` en Node.js 20 lanza error sincrónico en
  `createClient()` cuando no hay WebSocket nativo, lo cual impedía que NestJS terminara
  de bootstrapear → los crons de `@nestjs/schedule` nunca se registraban (ScheduleModule
  los registra en `onApplicationBootstrap`, que solo corre si el bootstrap completa).
  Solución: polyfill `globalThis.WebSocket = require('ws')` al nivel de módulo en
  `supabase.service.ts`, ANTES de llamar a `createClient`. El `transport` option de
  realtime no funciona en la versión instalada.
- `ws` agregado a `package.json` como dependencia explícita.
- Actualizado `app/admin/infraestructura/page.tsx` con link a Google Cloud Console.
- Todas las referencias a Fly.io en el código actualizadas.
- Confirmado funcionando post-fix: Supabase conecta, XP se procesa, level-ups se
  detectan, anuncios de Kick en vivo van a Discord/Telegram.

**Sesión más reciente — features varios**:
- **Gráfico XP por semana/mes en perfil**: `XpChart.tsx` (cliente, barras CSS, toggle 7d/30d,
  tooltip hover). Datos agregados server-side desde `xp_events` sin query extra.
  Se muestra en `/dashboard/profile/[username]` antes del heatmap.
- **Cosméticos en avatar del sidebar** (pendiente viejo resuelto): `SidebarXpBar` ahora muestra
  `nameEmoji` y el border del avatar con el color equipado. Se renderiza en el footer del sidebar.
- **Digest semanal automático Discord/Telegram**: módulo `worker/src/modules/weekly-digest/`,
  cron `0 12 * * 1` (lunes 12:00 UTC), top 5 por `weekly_xp`. Env vars:
  `DISCORD_DIGEST_CHANNEL_ID`, `TELEGRAM_DIGEST_THREAD_ID` (opcional).
- **Log de XP en tiempo real en admin**: `/admin/xp-log` — tabla con últimos 50 eventos,
  Supabase Realtime para actualizaciones en vivo, indicador verde pulsa con cada nuevo evento.
  Entrada "Log XP" en AdminSidebar con ícono Activity.
- **Leaderboard por plataforma en /ranking**: `PlatformLeaderboards.tsx`, top 5 por
  Discord/Twitch/Kick/YouTube/Telegram (últimos 90 días). Grid de 2 col, colores por plataforma.
- **Sistema de gifts (regalar SalchiCoins)**: `giftCoins(toUsername, amount, message?)` en
  `actions/shop.ts`. Valida saldo, no self-gift, usuario existente. Deduce del sender, acredita
  al recipient. Notificaciones `GIFT_SENT`/`GIFT_RECEIVED` para ambos. `GiftCoinsForm.tsx`
  (botón + formulario inline) en `/dashboard/coins`. Historial de coins muestra gifts.

- **Página pública `/referidos`**: `app/src/app/referidos/page.tsx` — no requiere login.
  Banner CTA arriba (explica la comunidad, botón "Registrarse gratis →"), cards de juegos abajo.
  Misma data que `/dashboard/referidos` pero accesible sin auth.

- **Anuncios de streams amigos (Kick)**: migración `015_friend_streamers.sql` (tabla
  `friend_streamers`: `name`, `kick_slug`, `is_active`). Worker: nuevo cron `*/5 * * * *`
  `checkFriendStreamers()` en `kick-api.service.ts` — consulta la API pública de Kick por cada
  amigo activo, detecta transición offline→online, postea embed en `DISCORD_FRIENDS_CHANNEL_ID`
  (dedup Redis `friend:live:{slug}` TTL 2h). Admin `/admin/amigos` para CRUD de la lista.
  Nueva env var: `DISCORD_FRIENDS_CHANNEL_ID=1523122468477468825`.

**Soporte Twitch en amigos streamers + fixes varios (sesión julio 2026)**:
- `checkFriendStreamers()` en `kick-api.service.ts` ahora chequea Kick Y Twitch por cada
  amigo. Usa `getTwitchStreamInfo(login)` con la API de Helix (client_credentials). Redis
  dedup: `friend:twitch:live:{login}` TTL 2h. Embed Discord color `0x9146FF`.
- `kick_slug` ahora opcional en `friend_streamers` (migración `018_friend_streamers_optional_kick.sql`).
  `twitch_login` agregado (migración `017_friend_streamers_twitch.sql`).
- Admin `/admin/amigos` actualizado: form con Kick (opcional) y Twitch (opcional), validación
  requiere al menos uno de los dos, tabla muestra links en verde (Kick) y morado (Twitch).
- Fix `isModerator()` en `kick.controller.ts`: chequea `sender.username` Y `sender.slug`
  (ambos lowercased) contra `KICK_CHANNEL_SLUG`. Resuelve `!addcom` no funcionando.
- `TELEGRAM_YOUTUBE_THREAD_ID=6763` agregado a VM .env — arregla YouTube publicando en
  canal general de Telegram en lugar del hilo correcto.
- Bot IRC de Twitch (`salchineta`) recuperado: `TWITCH_BOT_TOKEN`, `TWITCH_BOT_USERNAME`,
  `TWITCH_CHANNEL` agregados al .env de la VM (se habían perdido en migración Fly→GCP).
  Token generado vía twitchtokengenerator.com con la cuenta salchineta.
- Fix `resetDailyMissions`/`resetWeeklyMissions` en `scheduler.service.ts`: la subquery
  de Supabase no es iterable — se reemplazó por dos queries separadas (fetch IDs, luego delete).

**Sorteos de Twitch multi-canal (sesión julio 2026)**:
- Bot IRC se une a `#salchinft` inmediatamente al conectar. Luego, 3 segundos después
  (con delay para que Supabase esté listo), llama `joinFriendChannels()` que fetchea todos
  los `friend_streamers` con `twitch_login IS NOT NULL AND is_active=true` y hace JOIN.
  Eliminada la raza entre TCP connect callback y `SupabaseService.onModuleInit()`.
- `twitch_raffles`: columna `channel TEXT NOT NULL DEFAULT 'salchinft'` + índice
  `(channel, status)`. Migración `019_twitch_raffles_multichannel.sql`.
- `friend_streamers`: columna `user_id UUID REFERENCES profiles(id)` — se llena
  automáticamente cuando el streamer conecta su Twitch en configuración.
- `TwitchRaffle.tsx`: recibe `fixedChannel?` (streamer mode) o `channels?: ChannelOption[]`
  (admin mode con dropdown). Todas las queries de sorteo filtran por `channel`.
- Admin `/admin/raffles/twitch`: fetcha amigos con Twitch, pasa array `channels` al
  componente (dropdown para elegir canal).
- `/dashboard/sorteo-twitch`: page exclusiva para streamers amigos. Verifica que el usuario
  tenga Twitch vinculado Y esté en `friend_streamers`; si no, muestra instrucciones.
  Si sí, renderiza `<TwitchRaffle fixedChannel={login} />` bloqueado a su canal.
- Sidebar: sección "Streamer" con link "Sorteo Twitch" visible solo si `isFriendStreamer`.
  `dashboard/layout.tsx` detecta esto con una query adicional a `friend_streamers`.
- Auth Twitch callback (`/auth/twitch/route.ts`): al conectar, auto-linkea `user_id` en
  `friend_streamers` si el `twitch_login` coincide y aún no tenía usuario asignado.
- **Pendiente manual**: correr migración `019_twitch_raffles_multichannel.sql` en Supabase
  SQL Editor antes de que streamers amigos puedan usar sus sorteos.

**Comando `/decir` en Telegram (bot habla en el grupo)**: nuevo comando admin-only en
`telegram.service.ts` para que un admin le escriba al bot por su **chat privado** y el bot
reposte al grupo. Reusa `isGroupAdmin()` (mismo patrón que `/recordatorio`). Como el grupo
es un supergrupo con temas/subcanales, el destino es opcional con prefijo `#`:
`/decir <msg>` va al tema General; `/decir #<alias|id> <msg>` va a un subcanal (aliases
`#reclutamiento`/`#youtube`/`#digest` mapeados a `TELEGRAM_*_THREAD_ID`, o id numerico del
tema sacado del link `t.me/c/<grupo>/<numero>/...`). Comando `/canales` lista los alias y
explica como obtener el id de un tema. El texto se toma de `msg.text` crudo (sin lowercase)
para preservar mayusculas/tildes; se envia sin `parse_mode` para no romper con `<`/`&`.

**Fix definitivo `!addcom` en Kick (agosto 2026)**: `isModerator()` en `kick.controller.ts`
estaba roto porque el webhook de Kick NO tiene `sender.slug` — el campo real es
`sender.channel_slug` (verificado contra la doc oficial de KickDevDocs). Nuevo orden de
chequeos: (1) `sender.user_id === broadcaster.user_id` (el payload trae el objeto
`broadcaster`, comparación infalible), (2) fallback `username`/`channel_slug` vs
`KICK_CHANNEL_SLUG`, (3) badges `moderator`/`broadcaster`. El log de rechazo pasó de
`debug` a `warn` (Nest no muestra debug por default en PM2) e incluye ids y badges para
diagnosticar. Deploy: git pull + build + pm2 restart en la VM.
**Causa raíz adicional (misma sesión)**: los logs de PM2 mostraban CERO eventos de webhook
de Kick — la Webhook URL del Developer App de Kick seguía apuntando al dominio muerto de
Fly.io desde la migración a GCP. Kick manda los eventos a la URL configurada a nivel app
(kick.com → Settings → Developer), NO a una URL por suscripción. Fix manual: (1) regla de
firewall GCP `allow-worker-3001` (tcp:3001 ingress), (2) Webhook URL →
`http://34.121.74.142:3001/kick/webhook`. La doc de Kick solo exige URL públicamente
accesible, no HTTPS. Ojo: si la IP de la VM cambia, hay que actualizar la URL en Kick.
**Más hallazgos de la misma sesión**: (a) la IP vieja documentada (34.31.240.153) ya no
era la de la VM — siempre verificar con `curl ifconfig.me`; (b) con el puerto :3001 en la
URL Kick NO entregaba los eventos (aun con firewall abierto y endpoint verificado
alcanzable) — solo empezó a entregar con puerto 80: regla firewall `allow-worker-80` +
redirect en la VM `sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT
--to-ports 3001` + Webhook URL final `http://34.121.74.142/kick/webhook`. OJO: la regla
de iptables NO persiste reboots (ver Pendientes); (c) tras un mes de entregas fallidas
conviene borrar y recrear las suscripciones (DELETE /public/v1/events/subscriptions?id=X
con app token; el worker las recrea al reiniciar y loguea "Suscripcion a eventos de Kick
creada"); (d) el refresh token del bot en `kick_bot_tokens` estaba vencido/revocado
(`invalid_grant` → `sendChat failed: 401`) — se renueva rehaciendo el OAuth
authorization_code+PKCE a mano (PowerShell genera verifier/challenge, autorizar en el
navegador con la cuenta del bot, redirect `http://localhost:1337/` registrado en el dev
app, y UPDATE de la fila id=1 en el SQL Editor de Supabase). **Mejor aún**: se agregó al
worker un flujo OAuth propio para esto — `GET /kick/bot-auth/start?secret=WORKER_SECRET`
(logueado en Kick con la cuenta del bot) → autorizar → el callback
`GET /kick/bot-auth/callback` guarda los tokens en `kick_bot_tokens` automáticamente.
Requiere env var `KICK_BOT_REDIRECT_URI` en el .env de la VM. OJO: el form de Kick exige
HTTPS en las redirect URLs pero acepta `http://localhost` — como la VM no tiene TLS, se
usa `KICK_BOT_REDIRECT_URI=http://localhost:1337/` (registrada en el dev app): tras
autorizar, el navegador cae en `localhost:1337/?code=..&state=..` (error esperado) y hay
que reemplazar a mano `localhost:1337/` por `<IP VM>/kick/bot-auth/callback` en la barra
de direcciones conservando el query string. El intercambio code→token funciona igual
porque el redirect_uri solo tiene que coincidir con el del authorize.

**Sortea — nuevo producto (agosto 2026)**: nace `sortea/` en el repo — SaaS de sorteos
para streamers (Kick/Twitch), separado del hub. Decisiones: nombre "Sortea" (dominio
aspiracional sortea.gg), proyecto Next.js 15 propio (deploy como proyecto Vercel separado,
Root Directory=`sortea`, puerto dev 3100), misma DB de Supabase con tablas prefijo
`sortea_` + RLS por streamer, mismo worker de GCP (se generalizará por tenant). MVP:
solo sorteos. Hecho: scaffold + landing con lista de espera + migración draft
`020_sortea_tenants.sql` (**NO aplicada** — para cuando arranque la beta) + README con
roadmap de 5 etapas. Contexto de la decisión: el hub de XP casi no se usa (falta
incentivo/premios), pero las herramientas de streamer (sorteos, comandos, anuncios) sí —
se valida primero con los streamers amigos ya cargados antes de invertir en multi-tenant
completo y billing. **Decisión posterior (misma fecha)**: el hub queda RELEGADO — no se
desarrolla más sobre él; todo el esfuerzo va a Sortea.
**Sortea etapa 2 (auth) hecha**: magic link por email (Supabase Auth, sin providers
externos), middleware de sesión que protege `/panel`, rutas `/auth/kick` (PKCE, scopes
user:read channel:read chat:write events:subscribe) y `/auth/twitch` adaptadas del hub
pero guardando identidad+tokens en `sortea_streamers` (upsert por user_id), y `/panel`
con estado de conexiones y placeholder de sorteos. Build verificado. Setup manual
pendiente documentado en `sortea/README.md` (migración 020, redirect URIs en dev apps,
.env.local, redirect URLs del magic link en Supabase Auth).
**Streamea: login con contraseña en vez de magic link**: el SMTP gratuito de Supabase
limita a 2 mails/hora (dio "No pudimos enviar el mail" en la primera prueba real) y el
usuario prefería no depender del correo. `/login` ahora tiene tabs Entrar/Crear cuenta
con `signInWithPassword`/`signUp`. Requiere desactivar **Confirm email** en Supabase →
Authentication → Sign In / Providers → Email. Pendiente: SMTP propio (Resend/Brevo) para
poder ofrecer "olvidé mi contraseña".

**Rename Sortea → Streamea (misma fecha, definitivo)**: el usuario decidió que el
producto será una suite (no solo sorteos). Se evaluó "StreamTools" pero todos los
dominios buenos están tomados; **streamea.gg está libre** (verificado por DNS, falta
comprarlo). Carpeta final `streamea/`, migración `020_streamea_tenants.sql`, tablas
`st_*`, textos de UI → Streamea. Deploy: proyecto Vercel separado con Root
Directory=`streamea`. El hub queda deployado (relegado) porque el admin de sorteos
propio todavía vive ahí — se retira cuando Streamea etapa 3 lo reemplace.

**Streamea etapa 3 — multi-tenant (agosto 2026)**: nuevo módulo
`worker/src/modules/streamea/` totalmente independiente del hub:
- `StreameaKickService`: la lista de canales sale de `st_streamers` (NO de
  `KICK_CHANNEL_SLUG`). Cron cada 10 min (`syncTenants`) que refresca el mapa
  `broadcaster_user_id -> tenant` y crea las suscripciones de webhook que falten para
  cada streamer. `sendChat(broadcasterId, msg)` usa el token global del bot
  (`kick_bot_tokens`, cuenta streameabot) e intenta `type:'bot'` con fallback a
  `type:'user'`.
- `StreameaController` (`POST /streamea/webhook`): Kick manda todos los eventos de la
  app a una sola URL, así que se rutea por `payload.broadcaster.user_id`. Maneja
  `!addcom`/`!delcom` (solo broadcaster/mods, contra `st_commands` por streamer),
  comandos custom con cooldown por tenant, y entradas de sorteo en
  `st_raffle_entries` cuando el streamer tiene un `st_raffles` activo.
- Migración `021_streamea_commands.sql`: tabla `st_commands` + policies de
  INSERT/UPDATE/DELETE para que el streamer maneje sus comandos y sorteos desde el
  panel + columna `bot_is_mod`.
- Frontend: `/panel` con onboarding (aviso + botón copiar `/mod streameabot`),
  `/panel/sorteos` (abrir sorteo por keyword, ver participantes, sortear ganador,
  historial) y `/panel/comandos` (CRUD). Server actions en `panel/actions.ts` usando
  service role tras validar el dueño.
- `POST /streamea/say` (protegido con `x-worker-secret`): el panel de Vercel le pide al
  worker que el bot anuncie el inicio del sorteo y al ganador en el chat del streamer.
  Requiere `WORKER_URL` y `WORKER_SECRET` como env vars del proyecto de Vercel.
- `sendChat` usa `type:'user'` (no `'bot'`): con la cuenta streameabot, `type:'bot'`
  devuelve 500 porque no está registrada como bot oficial de Kick. Con `'user'` el
  mensaje sale igual con la identidad de streameabot.
- La página de sorteos se auto-refresca cada 5s (`AutoRefresh`) para ver entrar
  participantes en vivo.
- Kick NO permite agregar moderadores por API (su scope de moderación es solo
  ban/unban), así que el `/mod streameabot` es manual y el panel lo muestra listo para
  copiar. En Twitch SÍ se puede automatizar (Helix `POST /moderation/moderators` con
  scope `channel:manage:moderators`) — pendiente para cuando exista el bot de Twitch.
- **Pendiente manual**: correr la migración 021, cambiar la Webhook URL del dev app
  de Kick a `http://<IP VM>/streamea/webhook`, y agregar `WORKER_URL`/`WORKER_SECRET`
  en Vercel.

**Streamea etapa 4 — bot de Twitch multi-tenant (agosto 2026)**:
- Migración `022_streamea_bot_tokens.sql`: tabla `st_bot_tokens` (PK `platform`) con
  access/refresh token + `bot_user_id`/`bot_username` de la cuenta bot.
- **Alta del bot por la web, no por el worker**: Twitch exige HTTPS en los redirect URIs
  y la VM no tiene TLS, así que el OAuth de la cuenta bot vive en el proyecto de Vercel:
  `GET /setup/twitch-bot/start?key=<ADMIN_SETUP_KEY>` (scopes chat:read chat:edit,
  `force_verify=true` para elegir la cuenta correcta) → callback `/setup/twitch-bot`
  guarda todo en `st_bot_tokens`. Requiere env var `ADMIN_SETUP_KEY` en Vercel y
  registrar `https://<dominio>/setup/twitch-bot` como Redirect URL en el dev app.
- `StreameaTwitchService` (worker): IRC crudo por TCP (mismo patrón que el bot del hub),
  se conecta con el token de `st_bot_tokens` (refresh automático, cron cada 3h porque el
  token de Twitch dura ~4h) y joinea el canal de cada fila de `st_streamers` con
  `twitch_login`. Cron `*/10` para joinear canales nuevos sin reconectar. Comandos
  (`!addcom`/`!delcom`/custom) y entradas de sorteo por canal, contra las mismas tablas
  `st_commands`/`st_raffles` que Kick. Detección de mod por tags IRC (`badges=`, `mod=1`).
- **Auto-moderador en Twitch (lo que en Kick no se puede)**: el OAuth del streamer ahora
  pide `channel:manage:moderators`; `makeBotModerator()` llama
  `POST helix/moderation/moderators` con el token del streamer (refrescándolo si venció)
  y el `bot_user_id`. 204 = ok, 422 = ya era mod. Endpoint `POST /streamea/twitch/mod`
  (con `x-worker-secret`) + botón en `/panel`. Fallback: mostrar `/mod streameabot`.
- Sorteos: `/panel/sorteos` ahora tiene selector Kick/Twitch (solo si tiene las dos
  conectadas), y `POST /streamea/say` acepta `platform` para anunciar en el chat correcto.
- **Pendiente manual**: migración 022, `ADMIN_SETUP_KEY` en Vercel, redirect URL nueva en
  el dev app de Twitch, correr `/setup/twitch-bot/start` logueado con la cuenta bot, y
  que los streamers ya conectados **reconecten Twitch** para otorgar el scope nuevo.

**Migración a Supabase nuevo (misma sesión)**: el proyecto viejo de Supabase
(`lfkleoanvgdekfowxeex`) quedó pausado/borrado y el worker perdió conexión
(`fetch failed`). Se creó un proyecto nuevo (`oonrnecmhyxofdylzhux`) y se apuntó ahí
tanto Vercel como el `.env` de la VM. Las tablas del hub NO se migraron (historial de
XP/perfiles perdido, decisión consciente del usuario); solo se recrearon
`kick_bot_tokens`, `kick_commands` y `friend_streamers` para que el worker no rompa.
Ojo: los módulos del hub (XP, misiones, digest) van a tirar errores hasta que se
apaguen — pendiente de limpieza.

**App de Kick propia de Streamea (misma sesión)**: se creó un dev app nuevo bajo la
cuenta `streameabot` (client id `01M0TD1G5GDR0PEP4GPPECBN7R`), con scopes user:read,
channel:read, chat:write, events:subscribe. Se actualizaron `KICK_CLIENT_ID/SECRET` en
la VM y en Vercel. El `WORKER_SECRET` placeholder se reemplazó por uno aleatorio real.
El token del bot se obtuvo con el flujo `/kick/bot-auth/start` logueado como
streameabot (que además es moderador del canal).

**Streamea etapa 5 — sin servidor (septiembre 2026)**: se dio de baja Google Cloud
porque cobraba de a poco (la IP pública IPv4 cuesta ~USD 3/mes desde 2024, aunque la
e2-micro sea free tier). Decisión del usuario: dejar obsoleto TODO lo anterior — hub,
worker, bots de Discord/Telegram/YouTube y la VM. Streamea pasa a correr **100%
serverless en Vercel**, costo cero:
- **Twitch ya no usa IRC**: se verificó en la doc que `channel.chat.message` soporta
  transporte **webhook** en EventSub (requiere `user:read:chat` + `user:bot` del bot y
  `channel:bot` del broadcaster, o que el bot sea moderador). Enviar mensajes se hace
  con Helix `POST /chat/messages` (`user:write:chat`). Sin conexión permanente, no hace
  falta un proceso siempre encendido.
- `src/lib/kick.ts` y `src/lib/twitch.ts`: tokens de app y de bot con refresh perezoso,
  envío de chat REST, alta de suscripciones, y verificación de firma (RSA para Kick,
  HMAC para Twitch).
- `src/lib/chat.ts`: lógica compartida de comandos y sorteos, agnóstica de plataforma.
  `findTenant(platform, broadcasterId)` reemplaza el mapa en memoria del worker.
- `POST /api/kick/webhook` y `POST /api/twitch/webhook`: los eventos entran directo a
  Vercel (HTTPS gratis → adiós al parche de iptables puerto 80 y a la IP efímera). El de
  Twitch además responde el `webhook_callback_verification` con el challenge.
- **Cooldowns en la DB** (`st_cooldowns`, migración 023): en serverless no hay memoria
  entre invocaciones, así que el cooldown de comandos se persiste.
- **Sin crons**: las suscripciones se crean al momento de conectar la cuenta (en el
  callback de OAuth) y con el botón "activar bot", en vez del `syncTenants` cada 10 min.
  Vercel Hobby solo permite crons diarios, así que este diseño además es mejor.
- Alta del bot de Kick migrada del worker a la web (`/setup/kick-bot/start`): al tener
  HTTPS ya no hace falta el rodeo por `localhost:1337`.
- Los tokens de ambos bots viven en `st_bot_tokens` (la 023 migra la fila de Kick desde
  la vieja `kick_bot_tokens`).
- Borrados del repo: `worker/`, `app/`, `docs/`, `_backup_src_20260531/`.

## Estado actual (septiembre 2026)

**Solo existe Streamea**, en `streamea/`: Next.js 15 en Vercel (proyecto `streamea`,
dominio `streamea.vercel.app`), Supabase propio (`oonrnecmhyxofdylzhux`), sin VM ni
worker. Build verde. Costo de infraestructura: **cero**.

Funciona: registro con email+contraseña, conectar Kick y Twitch por OAuth, panel con
sorteos (keyword, participantes en vivo, sorteo de ganador anunciado en el chat) y
comandos custom (CRUD web + `!addcom`/`!delcom` desde el chat), todo multi-tenant.
El bot de la plataforma es `streameabot` en ambas plataformas.

Env vars del proyecto de Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `KICK_CLIENT_ID`,
`KICK_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `ADMIN_SETUP_KEY`,
`TWITCH_EVENTSUB_SECRET`, `NEXT_PUBLIC_SITE_URL`. (`WORKER_URL`/`WORKER_SECRET` ya no
se usan.)

## Variables de entorno adicionales en VM (agregadas en julio 2026)

Las siguientes vars fueron agregadas al `worker/.env` de la VM durante la migración o
sesiones posteriores — no estaban en el .env original de Fly.io:
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` — para la API de Helix (checkStreamStatus, checkFriendStreamers)
- `TWITCH_BOT_TOKEN` — OAuth token de la cuenta salchineta (twitchtokengenerator.com)
- `TWITCH_BOT_USERNAME=salchineta` — username del bot IRC
- `TWITCH_CHANNEL=salchinft` — canal de Twitch a joinear
- `TELEGRAM_YOUTUBE_THREAD_ID=6763` — hilo de Telegram para anuncios de YouTube
- `DISCORD_FRIENDS_CHANNEL_ID=1523122468477468825` — canal para anuncios de amigos streamers

## Pendientes (no bloqueantes)

- **Persistir el redirect de puerto 80→3001 en la VM**: la regla de iptables se pierde al
  reiniciar la VM. Fix: `sudo apt install iptables-persistent` y `sudo netfilter-persistent save`
  (o mover el worker a puerto 80 con setcap). Si la VM se reinicia y Kick deja de llegar,
  esto es lo primero a revisar — junto con la IP (efímera) en la Webhook URL de Kick.

- Cosméticos visibles en el avatar del sidebar (actualmente sí en perfil/leaderboard).
- Push notifications (level-up, misión completada, nuevo desafío) — hoy solo hay
  notificaciones in-app + Realtime, no push del navegador/móvil.
- Antes de un onboarding masivo: probar a mano los flujos críticos end-to-end (login,
  conectar redes, reclamar misión, subir de nivel, entrar a un sorteo, perfil en mobile).
- **handleVerifyButton Discord[50001]**: el bot no puede asignar el rol verificado porque
  no tiene permiso "Manage Roles" O su rol está por debajo del rol que intenta asignar.
  Fix: en Discord → Server Settings → Roles → mover el rol del bot SalchiNeta por encima
  del rol Verificado, y verificar que el bot tenga el permiso Manage Roles.
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

## Gotchas operativos (importante para no perder tiempo)

- **Bash mount stale/torn**: el sandbox de Linux a veces muestra contenido viejo o
  truncado de archivos que el `Edit`/`Write` tool (lado Windows) acaba de modificar
  correctamente — esto rompe `tsc`/`git diff`/`grep` con errores que no tienen sentido
  (ej: `Expression expected` a mitad de un `if`, o "binary file matches" después de un
  `sed`). La corrección NO es debuggear el código — es reescribir el archivo entero vía
  `cat > archivo <<'EOF' ... EOF` con el contenido correcto confirmado por `Read`/`Edit`,
  y recién ahí volver a correr `tsc`. Pasó repetidamente con `main.ts`, `app.module.ts`,
  `kick-api.service.ts`, `discord-bot.service.ts`, `telegram.service.ts`,
  `recruitment.service.ts`, y con varios archivos de `app/` en la sesión de misiones de
  Kick. Nunca usar `sed -i` sobre estos archivos — corrompió uno a binario.
- **Vercel deploy bloqueado**: si el dashboard dice "Deployment Blocked — commit author
  did not have access" y el repo es privado, pasarlo a público resuelve el problema de
  raíz (alternativa: que el usuario pushee siempre desde su propia cuenta/CLI).
- **La sandbox no tiene salida de red** a `id.kick.com`, Supabase REST, ni casi nada
  externo (proxy con allowlist) — el intercambio de OAuth code→token de Kick y los
  INSERT/UPDATE directos a Supabase hay que pedirle al usuario que los corra él
  (PowerShell `Invoke-RestMethod`, o SQL Editor de Supabase).
- **`fly` y `vercel` CLI no vienen preinstalados** en la sandbox — el usuario los instala
  con `npm i -g vercel` / sigue instrucciones de Fly, y corre los comandos en su propia
  terminal de Windows.
