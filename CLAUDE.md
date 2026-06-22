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

## Estado actual

Plataforma funcionalmente muy completa (ver Historial). `tsc --noEmit` limpio en
`app/` y `worker/` (hay ~85 errores preexistentes en `app/` no relacionados a Kick/este
trabajo, documentados como deuda técnica fuera de alcance). Worker corriendo en Fly.io
con todos los módulos activos (Discord, Telegram, YouTube, Twitch, Kick, Recruitment).

## Pendientes (no bloqueantes)

- Cosméticos visibles en el avatar del sidebar (actualmente sí en perfil/leaderboard).
- Push notifications (level-up, misión completada, nuevo desafío) — hoy solo hay
  notificaciones in-app + Realtime, no push del navegador/móvil.
- Antes de un onboarding masivo: probar a mano los flujos críticos end-to-end (login,
  conectar redes, reclamar misión, subir de nivel, entrar a un sorteo, perfil en mobile).

## Gotchas operativos (importante para no perder tiempo)

- **Bash mount stale/torn**: el sandbox de Linux a veces muestra contenido viejo o
  truncado de archivos que el `Edit`/`Write` tool (lado Windows) acaba de modificar
  correctamente — esto rompe `tsc`/`git diff`/`grep` con errores que no tienen sentido
  (ej: `Expression expected` a mitad de un `if`, o "binary file matches" después de un
  `sed`). La corrección NO es debuggear el código — es reescribir el archivo entero vía
  `cat > archivo <<'EOF' ... EOF` con el contenido correcto confirmado por `Read`/`Edit`,
  y recién ahí volver a correr `tsc`. Pasó repetidamente con `main.ts`, `app.module.ts`,
  `kick-api.service.ts`, `discord-bot.service.ts`, `telegram.service.ts`,
  `recruitment.service.ts`. Nunca usar `sed -i` sobre estos archivos — corrompió uno a
  binario.
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
