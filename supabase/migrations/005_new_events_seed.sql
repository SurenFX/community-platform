-- ============================================================
-- Migración 005: nuevos eventos de XP y misiones
-- Agrega eventos de Discord voice/join/reacción, Telegram join/reacción,
-- y misiones para Twitch gift sub + watch time que ya se detectaban.
-- ============================================================

-- ── Extender el enum xp_event_type con los nuevos valores ────────────────────
ALTER TYPE xp_event_type ADD VALUE IF NOT EXISTS 'DISCORD_REACTION_GIVEN';
ALTER TYPE xp_event_type ADD VALUE IF NOT EXISTS 'DISCORD_VOICE_TIME';
ALTER TYPE xp_event_type ADD VALUE IF NOT EXISTS 'DISCORD_JOIN';
ALTER TYPE xp_event_type ADD VALUE IF NOT EXISTS 'TELEGRAM_JOIN';
ALTER TYPE xp_event_type ADD VALUE IF NOT EXISTS 'TELEGRAM_REACTION';

-- ── xp_config: filas nuevas ──────────────────────────────────────────────────
INSERT INTO xp_config (event_type, base_xp, cooldown_sec, daily_cap, is_enabled)
VALUES
  -- Discord
  ('DISCORD_REACTION_GIVEN',   5,   60,   50,  true),
  ('DISCORD_VOICE_TIME',      15,  540,  180,  true),   -- cada 10 min en voz (cooldown 9 min)
  ('DISCORD_JOIN',           100,    0,    1,  true),   -- solo 1 por vida via daily_cap=1

  -- Twitch (pueden estar ya, usar ON CONFLICT)
  ('TWITCH_GIFT_SUB',        300,    0,    5,  true),
  ('TWITCH_WATCH_TIME',       15,  540,  180,  true),   -- cada 10 min viendo stream

  -- Telegram
  ('TELEGRAM_JOIN',          100,    0,    1,  true),
  ('TELEGRAM_REACTION',        5,   60,   50,  true)

ON CONFLICT (event_type) DO NOTHING;


-- ── missions: nuevas misiones ────────────────────────────────────────────────
INSERT INTO missions (title, description, type, objective_type, target_count, xp_reward, coin_reward, is_active, starts_at, ends_at)
VALUES

-- ── DISCORD — Nuevo ────────────────────────────────────────────────────────
('Bienvenido al servidor',     'Únete al servidor de Discord',                        'SPECIAL', 'DISCORD_JOIN',            1,    100,  0, true, now(), '2099-12-31'),
('Primera reacción dada',      'Reaccioná a un mensaje en Discord',                   'SPECIAL', 'DISCORD_REACTION_GIVEN',  1,     50,  0, true, now(), '2099-12-31'),
('Expresivo',                  'Reaccioná a 25 mensajes en Discord',                  'SPECIAL', 'DISCORD_REACTION_GIVEN',  25,   200,  0, true, now(), '2099-12-31'),
('Muy expresivo',              'Reaccioná a 100 mensajes en Discord',                 'SPECIAL', 'DISCORD_REACTION_GIVEN',  100,  600,  1, true, now(), '2099-12-31'),
('Expresivo total',            'Reaccioná a 500 mensajes en Discord',                 'SPECIAL', 'DISCORD_REACTION_GIVEN',  500, 2000,  3, true, now(), '2099-12-31'),
('Primer minuto en voz',       'Pasá 10 minutos en un canal de voz de Discord',       'SPECIAL', 'DISCORD_VOICE_TIME',       1,    50,  0, true, now(), '2099-12-31'),
('Voz activa',                 'Pasá 1 hora en canales de voz de Discord',            'SPECIAL', 'DISCORD_VOICE_TIME',       6,   200,  0, true, now(), '2099-12-31'),
('Habitué del voice',          'Pasá 5 horas en canales de voz de Discord',           'SPECIAL', 'DISCORD_VOICE_TIME',      30,   600,  1, true, now(), '2099-12-31'),
('Nativo del voice',           'Pasá 15 horas en canales de voz de Discord',          'SPECIAL', 'DISCORD_VOICE_TIME',      90,  1500,  3, true, now(), '2099-12-31'),
('Leyenda del voice',          'Pasá 50 horas en canales de voz de Discord',          'SPECIAL', 'DISCORD_VOICE_TIME',     300,  4000,  7, true, now(), '2099-12-31'),

-- ── TWITCH — Gift sub (ya se detecta, faltaban misiones) ───────────────────
('Generoso',                   'Regalá 1 sub en el canal',                            'SPECIAL', 'TWITCH_GIFT_SUB',          1,   400,  1, true, now(), '2099-12-31'),
('Gran mecenas',               'Regalá 5 subs en el canal',                           'SPECIAL', 'TWITCH_GIFT_SUB',          5,  1500,  3, true, now(), '2099-12-31'),
('Benefactor del canal',       'Regalá 10 subs en el canal',                          'SPECIAL', 'TWITCH_GIFT_SUB',         10,  3000,  7, true, now(), '2099-12-31'),

-- ── TWITCH — Watch time (ya se detecta, faltaban misiones) ─────────────────
('Primera hora de stream',     'Mirá 1 hora de stream',                               'SPECIAL', 'TWITCH_WATCH_TIME',        6,   100,  0, true, now(), '2099-12-31'),
('Fan del stream',             'Mirá 5 horas de stream',                              'SPECIAL', 'TWITCH_WATCH_TIME',       30,   300,  0, true, now(), '2099-12-31'),
('Habitué del stream',         'Mirá 15 horas de stream',                             'SPECIAL', 'TWITCH_WATCH_TIME',       90,   700,  1, true, now(), '2099-12-31'),
('Devoto del canal',           'Mirá 50 horas de stream',                             'SPECIAL', 'TWITCH_WATCH_TIME',      300,  2000,  3, true, now(), '2099-12-31'),
('Leyenda del stream',         'Mirá 150 horas de stream',                            'SPECIAL', 'TWITCH_WATCH_TIME',      900,  5000, 10, true, now(), '2099-12-31'),

-- ── TELEGRAM — Nuevo ───────────────────────────────────────────────────────
('Unido al grupo',             'Únete al grupo de Telegram',                          'SPECIAL', 'TELEGRAM_JOIN',            1,   100,  0, true, now(), '2099-12-31'),
('Primera reacción en Telegram','Reaccioná a un mensaje en Telegram',                 'SPECIAL', 'TELEGRAM_REACTION',        1,    50,  0, true, now(), '2099-12-31'),
('Expresivo en Telegram',      'Reaccioná a 25 mensajes en Telegram',                 'SPECIAL', 'TELEGRAM_REACTION',       25,   200,  0, true, now(), '2099-12-31'),
('Super reactivo',             'Reaccioná a 100 mensajes en Telegram',                'SPECIAL', 'TELEGRAM_REACTION',      100,   600,  1, true, now(), '2099-12-31')

ON CONFLICT (title) DO NOTHING;
