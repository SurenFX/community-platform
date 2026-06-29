-- Migración 014: badges por racha larga (7, 30, 60, 100 días consecutivos de login)

INSERT INTO badges (slug, name, description, image_url, tier, family, family_order, is_secret, condition)
VALUES
  ('streak_7',   'Racha de 7 días',   'Iniciaste sesión 7 días seguidos',   '🔥', 'BRONZE',    'streak', 1, false, '{"type":"streak","days":7}'),
  ('streak_30',  'Racha de 30 días',  'Iniciaste sesión 30 días seguidos',  '⚡', 'SILVER',    'streak', 2, false, '{"type":"streak","days":30}'),
  ('streak_60',  'Racha de 60 días',  'Iniciaste sesión 60 días seguidos',  '💫', 'GOLD',      'streak', 3, false, '{"type":"streak","days":60}'),
  ('streak_100', 'Racha de 100 días', 'Iniciaste sesión 100 días seguidos', '🌟', 'LEGENDARY', 'streak', 4, false, '{"type":"streak","days":100}')
ON CONFLICT (slug) DO NOTHING;
