-- Streamea sin worker: todo corre serverless en Vercel.
-- Correr en el SQL Editor del proyecto de Supabase de Streamea.

-- 1) Cooldowns de comandos. Antes vivian en memoria del worker; en serverless no hay
--    estado entre invocaciones, asi que se persisten.
CREATE TABLE IF NOT EXISTS st_cooldowns (
  key     TEXT PRIMARY KEY,          -- "<streamer_id>:<PLATAFORMA>:<comando>"
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE st_cooldowns ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo el service role (backend) lo toca.

-- 2) Mover el token del bot de Kick a la tabla generica st_bot_tokens
--    (kick_bot_tokens era del hub y queda obsoleta).
INSERT INTO st_bot_tokens (platform, access_token, refresh_token, expires_at, updated_at)
SELECT 'KICK', access_token, refresh_token, expires_at, now()
FROM kick_bot_tokens
WHERE id = 1
ON CONFLICT (platform) DO UPDATE
  SET access_token  = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at    = EXCLUDED.expires_at,
      updated_at    = now();

-- 3) Limpieza: tablas del hub que ya no usa nadie.
--    (Descomentar cuando confirmes que Streamea funciona sin el worker.)
-- DROP TABLE IF EXISTS kick_bot_tokens;
-- DROP TABLE IF EXISTS kick_commands;
-- DROP TABLE IF EXISTS friend_streamers;
