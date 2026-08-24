# Streamea — herramientas para streamers

Producto separado del hub de SalchiNFT (ex "Sortea", renombrado porque va a ser una
suite: sorteos primero, después comandos, anuncios, etc.). Misma infra (Supabase +
worker en GCP), proyecto Next.js propio, deploy como proyecto de Vercel independiente.

**Propuesta**: cualquier streamer conecta su Kick/Twitch con OAuth (un clic) y usa las
herramientas desde un panel, sin configurar bots ni APIs.

## Estado

MVP en construcción. Hecho: landing + auth completa (magic link + conectar Kick/Twitch
guardando tokens por streamer en `st_streamers`) + panel con estado de conexiones.
Falta la etapa 3 (panel de sorteos + generalizar el worker por tenant).

### Setup manual pendiente antes de probar auth

1. Aplicar `supabase/migrations/020_streamea_tenants.sql` en el SQL Editor de Supabase.
2. Registrar redirect URIs en los dev apps (con el dominio real de Vercel):
   - Kick: `https://<dominio>/auth/kick`
   - Twitch: `https://<dominio>/auth/twitch`
3. Env vars del proyecto de Vercel (Root Directory = `streamea`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...        (mismo del hub)
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (mismo del hub)
   SUPABASE_SERVICE_ROLE_KEY=...       (mismo del hub)
   KICK_CLIENT_ID=... / KICK_CLIENT_SECRET=...
   TWITCH_CLIENT_ID=... / TWITCH_CLIENT_SECRET=...
   ```
4. En Supabase → Auth → URL Configuration: Site URL = `https://<dominio>` y Redirect
   URLs con `https://<dominio>/**`.
5. **Login es email + contraseña** (no magic link — el SMTP gratis de Supabase limita a
   2 mails/hora). Para que el registro entre directo sin confirmar mail:
   Supabase → Authentication → Sign In / Providers → Email → desactivar **Confirm email**.
   Cuando haya SMTP propio (Resend/Brevo) se puede reactivar + agregar "olvidé mi
   contraseña".

### Etapa 3 (multi-tenant) — pasos manuales

1. Correr `supabase/migrations/021_streamea_commands.sql` en el SQL Editor.
2. En el dev app de Kick de Streamea: **Webhook URL** →
   `http://<IP de la VM>/streamea/webhook` (endpoint nuevo, multi-tenant).
   El endpoint viejo `/kick/webhook` es del hub y queda sin uso.
3. Deploy del worker en la VM (`git pull && npm run build && pm2 restart worker`).
4. Cada streamer: conecta Kick desde `/panel` y hace `/mod streameabot` en su chat.
   El worker sincroniza tenants cada 10 min (o al reiniciar) y crea las suscripciones
   de eventos por canal automáticamente.

## Roadmap por etapas

1. **Landing + lista de espera** (hecho).
2. **Auth + onboarding** (hecho) — login magic link, conectar Kick/Twitch, tokens por
   streamer en `st_streamers`.
3. **Panel de sorteos**: adaptar `TwitchRaffle.tsx`/`KickRaffle.tsx` del hub a las
   tablas `st_*`. El worker generaliza: bot IRC joinea canales de tenants activos,
   suscripciones de webhook de Kick por `broadcaster_user_id` de cada tenant.
4. **Beta cerrada** con 3-5 streamers amigos. Medir uso real.
5. **Billing** (Stripe) solo si la beta valida que pagarían.

## Correr en local (opcional)

```
cd streamea
npm install
npm run dev   # puerto 3100 (el hub usa 3000)
```

## Decisiones

- **Nombre**: Streamea (working name, rebrandeable — antes "Sortea").
- **Misma DB** que el hub, tablas con prefijo `st_` + RLS por streamer.
- **Mismo worker** de GCP para bots/webhooks — se generaliza por tenant en etapa 3.
- El hub queda relegado pero deployado hasta que Streamea cubra los sorteos propios.
