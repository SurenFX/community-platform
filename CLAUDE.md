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
  cron jobs (misiones, temporadas, XP, anuncios), webhooks. Desplegado en **Google Cloud
  Free Tier** (VM e2-micro, us-central1, IP pública `34.31.240.153`, proyecto `salchineta`).
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
  Free Tier (e2-micro, us-central1, IP `34.31.240.153`, proyecto `salchineta`).
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

## Estado actual

Plataforma funcionalmente muy completa (ver Historial). `tsc --noEmit` limpio en
`app/` y `worker/` (hay ~60 errores preexistentes en `app/` no relacionados a este
trabajo, documentados como deuda técnica fuera de alcance). Worker corriendo en
**Google Cloud Free Tier** (e2-micro us-central1, PM2 + systemd) con todos los módulos
activos: Discord, Telegram, YouTube, Twitch, Kick, Recruitment, WeeklyDigest.
Supabase conecta correctamente (fix globalThis.WebSocket). XP, level-ups, streaks y
anuncios de stream funcionando.

## Pendientes (no bloqueantes)

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
