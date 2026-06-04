-- Badges iniciales del sistema
-- condition es JSONB con el tipo y parámetros de evaluación

INSERT INTO badges (slug, name, description, tier, icon_url, is_secret, condition)
VALUES

-- ── NIVELES ─────────────────────────────────────────────────────────────────
('level_4',    'Seguidor',       'Alcanzaste el nivel 4',    'BRONZE',    NULL, false, '{"type":"level_reached","level":4}'),
('level_8',    'Habitual',       'Alcanzaste el nivel 8',    'BRONZE',    NULL, false, '{"type":"level_reached","level":8}'),
('level_13',   'Fanático',       'Alcanzaste el nivel 13',   'SILVER',    NULL, false, '{"type":"level_reached","level":13}'),
('level_20',   'Veterano',       'Alcanzaste el nivel 20',   'SILVER',    NULL, false, '{"type":"level_reached","level":20}'),
('level_28',   'Dedicado',       'Alcanzaste el nivel 28',   'GOLD',      NULL, false, '{"type":"level_reached","level":28}'),
('level_38',   'Élite',          'Alcanzaste el nivel 38',   'GOLD',      NULL, false, '{"type":"level_reached","level":38}'),
('level_50',   'Maestro',        'Alcanzaste el nivel 50',   'GOLD',      NULL, false, '{"type":"level_reached","level":50}'),
('level_65',   'Leyenda',        'Alcanzaste el nivel 65',   'LEGENDARY', NULL, false, '{"type":"level_reached","level":65}'),
('level_80',   'Inmortal',       'Alcanzaste el nivel 80',   'LEGENDARY', NULL, false, '{"type":"level_reached","level":80}'),
('level_100',  'Mítico',         'Alcanzaste el nivel 100',  'LEGENDARY', NULL, false, '{"type":"level_reached","level":100}'),

-- ── RACHAS ──────────────────────────────────────────────────────────────────
('streak_3',   'En racha',       '3 días consecutivos activo',    'BRONZE',    NULL, false, '{"type":"streak_reached","days":3}'),
('streak_7',   'Semana completa','7 días consecutivos activo',    'SILVER',    NULL, false, '{"type":"streak_reached","days":7}'),
('streak_14',  'Constante',      '14 días consecutivos activo',   'SILVER',    NULL, false, '{"type":"streak_reached","days":14}'),
('streak_30',  'Imparable',      '30 días consecutivos activo',   'GOLD',      NULL, false, '{"type":"streak_reached","days":30}'),
('streak_100', 'Legendario',     '100 días consecutivos activo',  'LEGENDARY', NULL, true,  '{"type":"streak_reached","days":100}'),

-- ── MISIONES ────────────────────────────────────────────────────────────────
('missions_1',  'Primer logro',  'Completaste tu primera misión',  'BRONZE', NULL, false, '{"type":"missions_completed","count":1}'),
('missions_5',  'Completista',   'Completaste 5 misiones',         'SILVER', NULL, false, '{"type":"missions_completed","count":5}'),
('missions_15', 'Cazador',       'Completaste 15 misiones',        'GOLD',   NULL, false, '{"type":"missions_completed","count":15}'),

-- ── DISCORD ─────────────────────────────────────────────────────────────────
('discord_100',  'Hablador',     '100 mensajes en Discord',  'BRONZE', NULL, false, '{"type":"xp_event_count","event":"DISCORD_MESSAGE","count":100}'),
('discord_1000', 'Sin callar',   '1000 mensajes en Discord', 'GOLD',   NULL, false, '{"type":"xp_event_count","event":"DISCORD_MESSAGE","count":1000}'),

-- ── TWITCH ──────────────────────────────────────────────────────────────────
('twitch_watcher', 'Stream lover', '60 minutos viendo el stream', 'BRONZE', NULL, false, '{"type":"stat_threshold","stat":"twitch_minutes","value":60}'),
('twitch_fanatic', 'Fanático',     '600 minutos viendo el stream','GOLD',   NULL, false, '{"type":"stat_threshold","stat":"twitch_minutes","value":600}'),

-- ── TELEGRAM ────────────────────────────────────────────────────────────────
('telegram_100', 'Telegráfico',  '100 mensajes en Telegram', 'SILVER', NULL, false, '{"type":"xp_event_count","event":"TELEGRAM_MESSAGE","count":100}')

ON CONFLICT (slug) DO NOTHING;
