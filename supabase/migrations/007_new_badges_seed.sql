-- Migración 007: nuevos badges para eventos agregados en 005
-- Cubre: Discord voice/join/reacciones, Twitch gift sub/watch time,
-- YouTube comentarios, Telegram join/reacciones, más misiones completadas.

INSERT INTO badges (slug, name, description, image_url, tier, is_secret, condition)
VALUES

-- ── DISCORD — Voice time (1 evento = 10 min) ────────────────────────────────
('voice_first',    'Voz activa',         'Pasaste 10 minutos en un canal de voz',    '🎙️', 'BRONZE',    false, '{"type":"xp_event_count","event":"DISCORD_VOICE_TIME","count":1}'),
('voice_1h',       'Vocero',             'Pasaste 1 hora en canales de voz',         '🎙️', 'BRONZE',    false, '{"type":"xp_event_count","event":"DISCORD_VOICE_TIME","count":6}'),
('voice_5h',       'Habitante del voz',  'Pasaste 5 horas en canales de voz',        '🔊', 'SILVER',    false, '{"type":"xp_event_count","event":"DISCORD_VOICE_TIME","count":30}'),
('voice_24h',      'Noctámbulo',         'Pasaste 24 horas en canales de voz',       '🌙', 'GOLD',      false, '{"type":"xp_event_count","event":"DISCORD_VOICE_TIME","count":144}'),
('voice_100h',     'Leyenda del voz',    'Pasaste 100 horas en canales de voz',      '👑', 'LEGENDARY', true,  '{"type":"xp_event_count","event":"DISCORD_VOICE_TIME","count":600}'),

-- ── DISCORD — Join ───────────────────────────────────────────────────────────
('discord_joined', 'Bienvenido',         'Te uniste al servidor de Discord',         '👋', 'BRONZE',    false, '{"type":"xp_event_count","event":"DISCORD_JOIN","count":1}'),

-- ── DISCORD — Reacciones dadas ───────────────────────────────────────────────
('reactor_25',     'Reactivo',           'Diste 25 reacciones en Discord',           '😄', 'BRONZE',    false, '{"type":"xp_event_count","event":"DISCORD_REACTION_GIVEN","count":25}'),
('reactor_200',    'Expresivo',          'Diste 200 reacciones en Discord',          '🤩', 'SILVER',    false, '{"type":"xp_event_count","event":"DISCORD_REACTION_GIVEN","count":200}'),
('reactor_1000',   'Emoji master',       'Diste 1000 reacciones en Discord',         '🎭', 'GOLD',      false, '{"type":"xp_event_count","event":"DISCORD_REACTION_GIVEN","count":1000}'),

-- ── TWITCH — Watch time (1 evento = 10 min) ──────────────────────────────────
('watch_1h',       'Espectador',         'Miraste 1 hora de stream',                 '📺', 'BRONZE',    false, '{"type":"xp_event_count","event":"TWITCH_WATCH_TIME","count":6}'),
('watch_10h',      'Fanático del stream','Miraste 10 horas de stream',               '🎮', 'SILVER',    false, '{"type":"xp_event_count","event":"TWITCH_WATCH_TIME","count":60}'),
('watch_50h',      'Stream adicto',      'Miraste 50 horas de stream',               '🔴', 'GOLD',      false, '{"type":"xp_event_count","event":"TWITCH_WATCH_TIME","count":300}'),
('watch_200h',     'Sin vida social',    'Miraste 200 horas de stream',              '💜', 'LEGENDARY', true,  '{"type":"xp_event_count","event":"TWITCH_WATCH_TIME","count":1200}'),

-- ── TWITCH — Gift sub ────────────────────────────────────────────────────────
('gift_sub_1',     'Generoso',           'Regalaste tu primer sub',                  '🎁', 'SILVER',    false, '{"type":"xp_event_count","event":"TWITCH_GIFT_SUB","count":1}'),
('gift_sub_5',     'Gran mecenas',       'Regalaste 5 subs',                         '🎁', 'GOLD',      false, '{"type":"xp_event_count","event":"TWITCH_GIFT_SUB","count":5}'),
('gift_sub_20',    'Benefactor',         'Regalaste 20 subs',                        '💎', 'LEGENDARY', true,  '{"type":"xp_event_count","event":"TWITCH_GIFT_SUB","count":20}'),

-- ── YOUTUBE — Comentarios ────────────────────────────────────────────────────
('youtube_5',      'Comentarista',       '5 comentarios en YouTube',                 '💬', 'BRONZE',    false, '{"type":"xp_event_count","event":"YOUTUBE_COMMENT","count":5}'),
('youtube_20',     'Crítico',            '20 comentarios en YouTube',                '✍️', 'SILVER',    false, '{"type":"xp_event_count","event":"YOUTUBE_COMMENT","count":20}'),
('youtube_50',     'Crítico elite',      '50 comentarios en YouTube',                '🏆', 'GOLD',      false, '{"type":"xp_event_count","event":"YOUTUBE_COMMENT","count":50}'),

-- ── TELEGRAM — Join ──────────────────────────────────────────────────────────
('telegram_joined','En el grupo',        'Te uniste al grupo de Telegram',           '✈️', 'BRONZE',    false, '{"type":"xp_event_count","event":"TELEGRAM_JOIN","count":1}'),

-- ── TELEGRAM — Reacciones ────────────────────────────────────────────────────
('tg_reactor_25',  'Reactivo TG',        'Diste 25 reacciones en Telegram',          '👍', 'BRONZE',    false, '{"type":"xp_event_count","event":"TELEGRAM_REACTION","count":25}'),
('tg_reactor_100', 'Expresivo TG',       'Diste 100 reacciones en Telegram',         '❤️', 'SILVER',    false, '{"type":"xp_event_count","event":"TELEGRAM_REACTION","count":100}'),

-- ── MISIONES COMPLETADAS — tiers más altos ───────────────────────────────────
('missions_30',    'Cazador élite',      'Completaste 30 misiones',                  '🎯', 'GOLD',      false, '{"type":"missions_completed","count":30}'),
('missions_60',    'Completista total',  'Completaste 60 misiones',                  '💯', 'LEGENDARY', false, '{"type":"missions_completed","count":60}')

ON CONFLICT (slug) DO NOTHING;
