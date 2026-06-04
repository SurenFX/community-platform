-- Misiones permanentes para todas las plataformas
-- Se usan ON CONFLICT DO NOTHING para no romper si ya existen

INSERT INTO missions (title, description, type, objective_type, target_count, xp_reward, ticket_reward, is_active, starts_at, ends_at)
VALUES

-- ── DISCORD ────────────────────────────────────────────────────────────────
('Primer mensaje',        'Mandá tu primer mensaje en Discord',               'SPECIAL', 'DISCORD_MESSAGE', 1,    50,   0,  true, now(), '2099-12-31'),
('Empezando a hablar',    'Mandá 10 mensajes en Discord',                     'SPECIAL', 'DISCORD_MESSAGE', 10,   150,  0,  true, now(), '2099-12-31'),
('Sociable',              'Mandá 50 mensajes en Discord',                     'SPECIAL', 'DISCORD_MESSAGE', 50,   400,  1,  true, now(), '2099-12-31'),
('Habitual del servidor', 'Mandá 150 mensajes en Discord',                    'SPECIAL', 'DISCORD_MESSAGE', 150,  800,  1,  true, now(), '2099-12-31'),
('Incansable',            'Mandá 500 mensajes en Discord',                    'SPECIAL', 'DISCORD_MESSAGE', 500,  2000, 3,  true, now(), '2099-12-31'),
('Leyenda del chat',      'Mandá 1000 mensajes en Discord',                   'SPECIAL', 'DISCORD_MESSAGE', 1000, 4000, 7,  true, now(), '2099-12-31'),
('Bien recibido',         'Recibí tu primera reacción en Discord',            'SPECIAL', 'DISCORD_REACTION_RECEIVED', 1,  75,  0, true, now(), '2099-12-31'),
('Popular',               'Recibí 25 reacciones en Discord',                  'SPECIAL', 'DISCORD_REACTION_RECEIVED', 25, 300, 1, true, now(), '2099-12-31'),
('Muy popular',           'Recibí 100 reacciones en Discord',                 'SPECIAL', 'DISCORD_REACTION_RECEIVED', 100, 800, 2, true, now(), '2099-12-31'),

-- ── TWITCH ─────────────────────────────────────────────────────────────────
('Primer chat',           'Mandá tu primer mensaje en el stream',             'SPECIAL', 'TWITCH_CHAT_MESSAGE', 1,   50,   0, true, now(), '2099-12-31'),
('Animador del stream',   'Mandá 20 mensajes en el stream',                   'SPECIAL', 'TWITCH_CHAT_MESSAGE', 20,  200,  0, true, now(), '2099-12-31'),
('Hablador del stream',   'Mandá 100 mensajes en el stream',                  'SPECIAL', 'TWITCH_CHAT_MESSAGE', 100, 600,  1, true, now(), '2099-12-31'),
('Fiel del stream',       'Mandá 500 mensajes en el stream',                  'SPECIAL', 'TWITCH_CHAT_MESSAGE', 500, 2000, 3, true, now(), '2099-12-31'),
('Fan del canal',         'Seguí el canal de Twitch',                         'SPECIAL', 'TWITCH_FOLLOW',       1,   100,  0, true, now(), '2099-12-31'),
('Sub apoyador',          'Subscribite al canal',                             'SPECIAL', 'TWITCH_SUBSCRIBE',    1,   500,  2, true, now(), '2099-12-31'),
('Fanático sub',          'Subscribite 3 meses al canal',                     'SPECIAL', 'TWITCH_SUBSCRIBE',    3,   1200, 5, true, now(), '2099-12-31'),
('Primer raid',           'Participá en un raid',                             'SPECIAL', 'TWITCH_RAID_PARTICIPATE', 1, 150, 0, true, now(), '2099-12-31'),
('Raider habitual',       'Participá en 5 raids',                             'SPECIAL', 'TWITCH_RAID_PARTICIPATE', 5, 500, 2, true, now(), '2099-12-31'),

-- ── YOUTUBE ────────────────────────────────────────────────────────────────
('Primer comentario',     'Comentá en un video del canal',                    'SPECIAL', 'YOUTUBE_COMMENT', 1,  50,  0, true, now(), '2099-12-31'),
('Comentarista',          'Comentá en 5 videos del canal',                    'SPECIAL', 'YOUTUBE_COMMENT', 5,  200, 0, true, now(), '2099-12-31'),
('Crítico de contenido',  'Comentá en 20 videos del canal',                   'SPECIAL', 'YOUTUBE_COMMENT', 20, 600, 1, true, now(), '2099-12-31'),
('Suscriptor',            'Subscribite al canal de YouTube',                  'SPECIAL', 'YOUTUBE_SUBSCRIBE', 1, 200, 0, true, now(), '2099-12-31'),

-- ── TELEGRAM ───────────────────────────────────────────────────────────────
('Hola al grupo',         'Mandá tu primer mensaje en el grupo de Telegram',  'SPECIAL', 'TELEGRAM_MESSAGE', 1,    50,   0, true, now(), '2099-12-31'),
('Activo en Telegram',    'Mandá 10 mensajes en el grupo de Telegram',        'SPECIAL', 'TELEGRAM_MESSAGE', 10,   150,  0, true, now(), '2099-12-31'),
('Telegráfico',           'Mandá 50 mensajes en el grupo de Telegram',        'SPECIAL', 'TELEGRAM_MESSAGE', 50,   400,  1, true, now(), '2099-12-31'),
('Maestro del grupo',     'Mandá 200 mensajes en el grupo de Telegram',       'SPECIAL', 'TELEGRAM_MESSAGE', 200,  1000, 2, true, now(), '2099-12-31'),
('Leyenda de Telegram',   'Mandá 500 mensajes en el grupo de Telegram',       'SPECIAL', 'TELEGRAM_MESSAGE', 500,  2000, 5, true, now(), '2099-12-31'),
('Telegrama mil',         'Mandá 1000 mensajes en el grupo de Telegram',      'SPECIAL', 'TELEGRAM_MESSAGE', 1000, 4000, 10, true, now(), '2099-12-31')

ON CONFLICT (title) DO NOTHING;
