-- Tokens temporales para vinculación de Telegram via deep link
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token       TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar por user_id (para invalidar tokens anteriores)
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON telegram_link_tokens(user_id);

-- RLS
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- El usuario puede insertar su propio token
CREATE POLICY "users can insert own tokens"
  ON telegram_link_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- El usuario puede leer sus propios tokens (para polling)
CREATE POLICY "users can select own tokens"
  ON telegram_link_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- El worker usa service_role, no necesita política para update/delete
