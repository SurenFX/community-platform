-- Streamea (producto multi-streamer): tenants + sorteos multi-tenant
-- NO aplicar todavia — draft para cuando arranque la beta de Streamea.
-- Convive con las tablas del hub sin tocarlas (prefijo st_).

-- Un streamer = un tenant. La config que hoy vive en env vars del worker
-- pasa a ser una fila por streamer.
CREATE TABLE IF NOT EXISTS st_streamers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- dueño de la cuenta (auth de Supabase; puede ser NULL hasta que reclame el perfil)
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  -- plataformas conectadas (NULL = no conectada)
  kick_slug     TEXT UNIQUE,
  kick_user_id  TEXT,
  twitch_login  TEXT UNIQUE,
  twitch_user_id TEXT,
  -- tokens OAuth por streamer (lo que hoy es kick_bot_tokens fila unica)
  kick_access_token   TEXT,
  kick_refresh_token  TEXT,
  kick_expires_at     TIMESTAMPTZ,
  twitch_access_token  TEXT,
  twitch_refresh_token TEXT,
  twitch_expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  plan          TEXT NOT NULL DEFAULT 'beta',  -- beta | free | pro
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Sorteos multi-tenant (reemplaza el patron kick_raffles/twitch_raffles de fila global)
CREATE TABLE IF NOT EXISTS st_raffles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  streamer_id  UUID NOT NULL REFERENCES st_streamers(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('KICK', 'TWITCH')),
  keyword      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'drawn')),
  winner       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  closed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_st_raffles_streamer_status
  ON st_raffles (streamer_id, status);

CREATE TABLE IF NOT EXISTS st_raffle_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raffle_id   UUID NOT NULL REFERENCES st_raffles(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  entered_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (raffle_id, username)
);

-- RLS: cada streamer ve solo lo suyo; el worker usa service role (bypass)
ALTER TABLE st_streamers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_raffles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE st_raffle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streamer lee su perfil" ON st_streamers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "streamer lee sus sorteos" ON st_raffles
  FOR SELECT USING (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );

CREATE POLICY "streamer lee sus entradas" ON st_raffle_entries
  FOR SELECT USING (
    raffle_id IN (
      SELECT r.id FROM st_raffles r
      JOIN st_streamers s ON s.id = r.streamer_id
      WHERE s.user_id = auth.uid()
    )
  );
