-- Migración 006: asignar coin_reward (SalchiCoins) a todas las misiones
-- que quedaron con coin_reward = 0 o NULL de la migración 003.
-- Criterio: a mayor dificultad/XP, más SC.

UPDATE missions SET coin_reward = CASE title

  -- ── DISCORD — Mensajes ──────────────────────────────────────────────────
  WHEN 'Primer mensaje'        THEN 10
  WHEN 'Empezando a hablar'    THEN 25
  WHEN 'Sociable'              THEN 50
  WHEN 'Habitual del servidor' THEN 75
  WHEN 'Incansable'            THEN 150
  WHEN 'Leyenda del chat'      THEN 300

  -- ── DISCORD — Reacciones recibidas ─────────────────────────────────────
  WHEN 'Bien recibido'         THEN 10
  WHEN 'Popular'               THEN 50
  WHEN 'Muy popular'           THEN 100

  -- ── TWITCH — Chat ───────────────────────────────────────────────────────
  WHEN 'Primer chat'           THEN 10
  WHEN 'Animador del stream'   THEN 25
  WHEN 'Hablador del stream'   THEN 75
  WHEN 'Fiel del stream'       THEN 200

  -- ── TWITCH — Follow / Sub / Raid ────────────────────────────────────────
  WHEN 'Fan del canal'         THEN 20
  WHEN 'Sub apoyador'          THEN 100
  WHEN 'Fanático sub'          THEN 250
  WHEN 'Primer raid'           THEN 25
  WHEN 'Raider habitual'       THEN 100

  -- ── YOUTUBE ─────────────────────────────────────────────────────────────
  WHEN 'Primer comentario'     THEN 10
  WHEN 'Comentarista'          THEN 30
  WHEN 'Crítico de contenido'  THEN 75
  WHEN 'Suscriptor'            THEN 40

  -- ── TELEGRAM — Mensajes ─────────────────────────────────────────────────
  WHEN 'Hola al grupo'         THEN 10
  WHEN 'Activo en Telegram'    THEN 25
  WHEN 'Telegráfico'           THEN 50
  WHEN 'Maestro del grupo'     THEN 100
  WHEN 'Leyenda de Telegram'   THEN 200
  WHEN 'Telegrama mil'         THEN 400

  ELSE coin_reward  -- no tocar las misiones que ya tienen valor
END
WHERE title IN (
  'Primer mensaje', 'Empezando a hablar', 'Sociable', 'Habitual del servidor',
  'Incansable', 'Leyenda del chat',
  'Bien recibido', 'Popular', 'Muy popular',
  'Primer chat', 'Animador del stream', 'Hablador del stream', 'Fiel del stream',
  'Fan del canal', 'Sub apoyador', 'Fanático sub', 'Primer raid', 'Raider habitual',
  'Primer comentario', 'Comentarista', 'Crítico de contenido', 'Suscriptor',
  'Hola al grupo', 'Activo en Telegram', 'Telegráfico', 'Maestro del grupo',
  'Leyenda de Telegram', 'Telegrama mil'
);
