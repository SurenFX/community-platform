-- Streamea: tokens de las cuentas bot de la plataforma (una fila por plataforma).
-- El bot de Kick ya vive en kick_bot_tokens; esta tabla es la generica para Twitch
-- (y las que vengan). Solo la usa el worker con service role.

CREATE TABLE IF NOT EXISTS st_bot_tokens (
  platform      TEXT PRIMARY KEY,          -- 'TWITCH' | 'KICK' | ...
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  bot_user_id   TEXT,                      -- id numerico de la cuenta bot
  bot_username  TEXT,                      -- login de la cuenta bot
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE st_bot_tokens ENABLE ROW LEVEL SECURITY;
-- Sin policies: nadie con anon key puede leerlo. El worker usa service role (bypass).
