# Sortea — sorteos en vivo para streamers

Producto separado del hub de SalchiNFT. Misma infra (Supabase + worker en GCP),
proyecto Next.js propio, deploy como proyecto de Vercel independiente con su dominio.

**Propuesta**: cualquier streamer conecta su Kick/Twitch con OAuth (un clic) y puede
lanzar sorteos por palabra clave desde un panel, sin configurar bots ni APIs.

## Estado

MVP en construcción. Hoy: landing + migración draft de tenants (`supabase/migrations/020_sortea_tenants.sql`, **no aplicada**).

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
