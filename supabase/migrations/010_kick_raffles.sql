-- Migración 010: sorteos en vivo de Kick (mismo patrón que twitch_raffles/twitch_raffle_entries)

-- 1. Agregar 'KICK' al enum social_platform, si existe como tipo enum.
--    (Si en tu base 'platform' de user_social_links es un CHECK constraint en vez de
--     un enum, agregá 'KICK' a esa lista manualmente desde el SQL editor.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'social_platform' AND typtype = 'e'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'social_platform' AND e.enumlabel = 'KICK'
    ) THEN
      ALTER TYPE social_platform ADD VALUE 'KICK';
    END IF;
  END IF;
END $$;

-- 2. Sorteo activo de Kick (uno a la vez, igual que Twitch)
CREATE TABLE IF NOT EXISTS kick_raffles (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword              text        NOT NULL,
  status               text        NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'stopped', 'drawn', 'cancelled', 'closed')),
  winner_kick_username text,
  winner_id            uuid REFERENCES profiles(id),
  drawn_at             timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 3. Participantes del sorteo (escriben la keyword en el chat de Kick)
CREATE TABLE IF NOT EXISTS kick_raffle_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id     uuid        NOT NULL REFERENCES kick_raffles(id) ON DELETE CASCADE,
  kick_username text        NOT NULL,
  user_id       uuid REFERENCES profiles(id),
  entered_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, kick_username)
);

CREATE INDEX IF NOT EXISTS idx_kick_raffle_entries_raffle_id ON kick_raffle_entries(raffle_id);

-- 4. RLS
ALTER TABLE kick_raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kick_raffle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON kick_raffles USING (true) WITH CHECK (true);
CREATE POLICY "service role full access" ON kick_raffle_entries USING (true) WITH CHECK (true);

-- 5. Realtime (la UI escucha INSERTs en kick_raffle_entries)
ALTER PUBLICATION supabase_realtime ADD TABLE kick_raffle_entries;

-- 6. Tokens OAuth del bot de Kick (fila única, id=1)
--    Se completa a mano la primera vez (luego del flujo OAuth manual descripto
--    en la guía de setup), y el worker la mantiene actualizada via refresh_token.
CREATE TABLE IF NOT EXISTS kick_bot_tokens (
  id            int         PRIMARY KEY DEFAULT 1,
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kick_bot_tokens_single_row CHECK (id = 1)
);

ALTER TABLE kick_bot_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON kick_bot_tokens USING (true) WITH CHECK (true);
