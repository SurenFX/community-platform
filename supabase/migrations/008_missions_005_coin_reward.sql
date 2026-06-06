-- Migración 008: asignar coin_reward a misiones de la migración 005
-- que quedaron con coin_reward = 0.

UPDATE missions SET coin_reward = CASE title

  -- ── DISCORD — Join ──────────────────────────────────────────────────────
  WHEN 'Bienvenido al servidor'      THEN 15

  -- ── DISCORD — Reacciones dadas ─────────────────────────────────────────
  WHEN 'Primera reacción dada'       THEN 10
  WHEN 'Expresivo'                   THEN 30
  WHEN 'Muy expresivo'               THEN 75
  -- 'Expresivo total' ya tiene 3 → lo dejamos

  -- ── DISCORD — Voice time ────────────────────────────────────────────────
  WHEN 'Primer minuto en voz'        THEN 10
  WHEN 'Voz activa'                  THEN 25
  -- 'Habitué del voice' ya tiene 1 → lo dejamos

  -- ── TWITCH — Watch time ─────────────────────────────────────────────────
  WHEN 'Primera hora de stream'      THEN 15
  WHEN 'Fan del stream'              THEN 40

  -- ── TWITCH — Gift sub ───────────────────────────────────────────────────
  -- 'Generoso' ya tiene 1, 'Gran mecenas' ya tiene 3 → los dejamos

  -- ── TELEGRAM — Join ─────────────────────────────────────────────────────
  WHEN 'Unido al grupo'              THEN 15

  -- ── TELEGRAM — Reacciones ───────────────────────────────────────────────
  WHEN 'Primera reacción en Telegram' THEN 10
  WHEN 'Expresivo en Telegram'        THEN 30
  -- 'Super reactivo' ya tiene 1 → lo dejamos

  ELSE coin_reward
END
WHERE title IN (
  'Bienvenido al servidor',
  'Primera reacción dada', 'Expresivo', 'Muy expresivo',
  'Primer minuto en voz', 'Voz activa',
  'Primera hora de stream', 'Fan del stream',
  'Unido al grupo',
  'Primera reacción en Telegram', 'Expresivo en Telegram'
);
