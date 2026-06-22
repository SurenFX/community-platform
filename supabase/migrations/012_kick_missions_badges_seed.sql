-- Migración 012: xp_config + misiones + badges de Kick (mismo patrón que Twitch).
--
-- Requiere que 011_kick_xp_enum.sql ya haya corrido y terminado (en una transacción
-- separada) antes de este archivo, porque acá se usan los valores nuevos del enum
-- xp_event_type (KICK_CHAT_MESSAGE, KICK_FOLLOW, KICK_SUBSCRIBE).

-- 1. Configuración de XP por evento (ajustable después desde /admin/xp-config)
INSERT INTO xp_config (event_type, base_xp, cooldown_sec, daily_cap, is_enabled)
VALUES
  ('KICK_CHAT_MESSAGE', 8,   10, 500,  true),
  ('KICK_FOLLOW',       100, 0,  1000, true),
  ('KICK_SUBSCRIBE',    500, 0,  2000, true)
ON CONFLICT (event_type) DO NOTHING;

-- 2. Misiones (mismos títulos/montos que las de Twitch, adaptadas a Kick)
INSERT INTO missions (title, description, type, objective_type, target_count, xp_reward, ticket_reward, coin_reward, is_active, starts_at, ends_at)
VALUES
  ('Primer chat en Kick',         'Mandá tu primer mensaje en el stream de Kick', 'SPECIAL', 'KICK_CHAT_MESSAGE', 1,   50,   0, 10,  true, now(), '2099-12-31'),
  ('Animador del stream (Kick)',  'Mandá 20 mensajes en el stream de Kick',       'SPECIAL', 'KICK_CHAT_MESSAGE', 20,  200,  0, 25,  true, now(), '2099-12-31'),
  ('Hablador del stream (Kick)',  'Mandá 100 mensajes en el stream de Kick',      'SPECIAL', 'KICK_CHAT_MESSAGE', 100, 600,  1, 75,  true, now(), '2099-12-31'),
  ('Fiel del stream (Kick)',      'Mandá 500 mensajes en el stream de Kick',      'SPECIAL', 'KICK_CHAT_MESSAGE', 500, 2000, 3, 200, true, now(), '2099-12-31'),
  ('Fan del canal en Kick',       'Seguí el canal de Kick',                       'SPECIAL', 'KICK_FOLLOW',       1,   100,  0, 20,  true, now(), '2099-12-31'),
  ('Sub apoyador en Kick',        'Subscribite al canal de Kick',                 'SPECIAL', 'KICK_SUBSCRIBE',    1,   500,  2, 100, true, now(), '2099-12-31'),
  ('Fanático sub en Kick',        'Subscribite 3 meses al canal de Kick',         'SPECIAL', 'KICK_SUBSCRIBE',    3,   1200, 5, 250, true, now(), '2099-12-31')
ON CONFLICT (title) DO NOTHING;

-- 3. Badges (family = 'kick', mismo patrón que discord_100/discord_1000/discord_joined)
INSERT INTO badges (slug, name, description, image_url, tier, family, family_order, is_secret, condition)
VALUES
  ('kick_followed',   'Seguidor en Kick',  'Seguiste el canal de Kick',     '🟢', 'BRONZE', 'kick', 1, false, '{"type":"xp_event_count","event":"KICK_FOLLOW","count":1}'),
  ('kick_100',         'Hablador (Kick)',   '100 mensajes en el chat de Kick', '💬', 'BRONZE', 'kick', 2, false, '{"type":"xp_event_count","event":"KICK_CHAT_MESSAGE","count":100}'),
  ('kick_500',         'Fiel del chat (Kick)', '500 mensajes en el chat de Kick', '🔥', 'SILVER', 'kick', 3, false, '{"type":"xp_event_count","event":"KICK_CHAT_MESSAGE","count":500}'),
  ('kick_1000',        'Sin callar (Kick)', '1000 mensajes en el chat de Kick', '🏆', 'GOLD',   'kick', 4, false, '{"type":"xp_event_count","event":"KICK_CHAT_MESSAGE","count":1000}'),
  ('kick_subscribed',  'Suscriptor en Kick', 'Te suscribiste al canal de Kick', '💎', 'SILVER', 'kick', 5, false, '{"type":"xp_event_count","event":"KICK_SUBSCRIBE","count":1}')
ON CONFLICT (slug) DO NOTHING;
