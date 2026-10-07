# Streamea — herramientas para streamers

Web al estilo de Nightbot para conectar Kick y Twitch, configurar el bot,
crear comandos, organizar sorteos y gestionar avisos. Community Hub quedó
descartado; no se desarrolla gamificación ni se restauran los avisos de Eldoria.

## Arquitectura actual

- Next.js 15 en Vercel; dominio documentado: streamea.vercel.app.
- Supabase para usuarios, tokens, configuración y participantes.
- Kick y Twitch entregan chat por webhooks HTTPS y las respuestas usan sus APIs HTTP.
- Google Cloud quedó dado de baja el 7/10/2026. El antiguo worker no forma parte de la aplicación actual.

## Funciones implementadas

Registro con email y contraseña, OAuth de Kick/Twitch, comandos personalizados
(desde el panel o !addcom / !delcom), sorteos por palabra clave y datos por streamer.
Los flujos completos en producción todavía requieren validación en un canal real.

## Correcciones — octubre 2026

Aplicar ../supabase/migrations/024_streamea_bot_reliability.sql en el SQL Editor
del Supabase de Streamea ANTES de desplegar estas correcciones.

- Cooldowns atómicos para impedir respuestas simultáneas duplicadas.
- Deduplicación de eventos, incluidos comandos de gestión y entradas de sorteos.
- Eventos de más de diez minutos se descartan, con un minuto de tolerancia al futuro.
- Los recibos antiguos se limpian para evitar crecimiento indefinido.
- Panel con última actividad recibida; conectar una cuenta no confirma que el bot funcione.
- Activación y reintento de lectura del chat con resultado visible.

Se procesa cada evento a lo sumo una vez. Si el envío falla después de reservarlo,
no se reenvía al repetir ese evento; no se garantiza entrega exactamente una vez.

## Desarrollo

Desde esta carpeta: npm install, npm run dev (puerto 3100), npm run typecheck,
npm test y npm run build. Las pruebas usan PostgreSQL temporal PGlite y APIs
simuladas: no envían mensajes a canales reales.

Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, KICK_CLIENT_ID, KICK_CLIENT_SECRET, TWITCH_CLIENT_ID,
TWITCH_CLIENT_SECRET, ADMIN_SETUP_KEY, TWITCH_EVENTSUB_SECRET y NEXT_PUBLIC_SITE_URL.
Guardar valores en configuración local o Vercel; nunca en Git.

Alta del bot: /setup/kick-bot/start y /setup/twitch-bot/start, protegidas por
ADMIN_SETUP_KEY. Tokens en st_bot_tokens. Registrar las URLs de OAuth/webhooks
con el dominio HTTPS vigente y otorgar los permisos de cada plataforma.

## Siguiente etapa

1. Aplicar migración, desplegar y probar chat, comandos y sorteos en un canal real.
2. Avisos configurables: texto, destino, frecuencia/condiciones e interruptor.
3. Discord y Telegram como destinos opcionales de avisos.
4. Beta con un grupo pequeño de streamers.

Los avisos aún no están implementados. Elegir funciones según límites del
alojamiento: no asumir costo cero para cualquier uso.
