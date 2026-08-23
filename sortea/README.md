# Sortea — sorteos en vivo para streamers

Producto separado del hub de SalchiNFT. Misma infra (Supabase + worker en GCP),
proyecto Next.js propio, deploy como proyecto de Vercel independiente con su dominio.

**Propuesta**: cualquier streamer conecta su Kick/Twitch con OAuth (un clic) y puede
lanzar sorteos por palabra clave desde un panel, sin configurar bots ni APIs.

## Estado

MVP en construcción. Hoy: landing + auth completa (magic link + conectar Kick/Twitch
guardando tokens por streamer en `sortea_streamers`) + panel con estado de conexiones.
Falta la etapa 3 (panel de sorteos + generalizar el worker).

### Setup manual pendiente antes de probar auth

1. Aplicar `supabase/migrations/020_sortea_tenants.sql` en el SQL Editor de Supabase.
2. Registrar redirect URIs en los dev apps:
   - Kick: `http://localhost:3100/auth/kick` (dev) y `https://<dominio>/auth/kick` (prod)
   - Twitch: `http://localhost:3100/auth/twitch` y `https://<dominio>/auth/twitch`
3. Crear `sortea/.env.local` con:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...        (mismo del hub)
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (mismo del hub)
   SUPABASE_SERVICE_ROLE_KEY=...       (mismo del hub)
   KICK_CLIENT_ID=... / KICK_CLIENT_SECRET=...
   TWITCH_CLIENT_ID=... / TWITCH_CLIENT_SECRET=...
   ```
4. En Supabase → Auth → URL Configuration: agregar `http://localhost:3100/auth/callback`
   (y el de prod) a las Redirect URLs permitidas para el magic link.

## Roadmap por etapas

1. **Landing + lista de espera** (hecho) — validar interés con los streamers amigos.
2. **Auth + onboarding**: login (Supabase Auth), "Conectar Kick" / "Conectar Twitch"
   reutilizando los flujos OAuth PKCE que ya existen en el hub (`/auth/kick`,
   `/auth/twitch` y el `bot-auth` del worker). Tokens por streamer en
   `sortea_streamers` (no más fila única).
3. **Panel de sorteos**: adaptar `TwitchRaffle.tsx` (ya soporta `fixedChannel`) y
   `KickRaffle.tsx` a las tablas `sortea_*`. El worker necesita: bot IRC de Twitch que
   joinee canales de tenants activos (ya lo hace con `friend_streamers` — generalizar),
   y suscripciones de webhook de Kick por `broadcaster_user_id` de cada tenant (la API
   de Kick lo permite con el mismo App Access Token).
4. **Beta cerrada** con 3-5 streamers amigos. Medir uso real.
5. **Billing** (Stripe) solo si la beta valida que pagarían.

## Correr en local

```
cd sortea
npm install
npm run dev   # puerto 3100 (el hub usa 3000)
```

## Deploy (cuando toque)

Nuevo proyecto en Vercel apuntando al mismo repo con **Root Directory = `sortea`**.
Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mismas del hub),
más adelante `KICK_CLIENT_ID/SECRET` y `TWITCH_CLIENT_ID/SECRET` para el OAuth.

## Decisiones

- **Nombre**: Sortea (dominio aspiracional: sortea.gg). Renombrable.
- **Misma DB** que el hub, tablas con prefijo `sortea_` + RLS por streamer.
- **Mismo worker** de GCP para bots/webhooks — se generaliza por tenant en etapa 3.
