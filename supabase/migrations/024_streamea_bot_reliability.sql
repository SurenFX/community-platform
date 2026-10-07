-- Aplicar antes de desplegar las correcciones de comandos y estado del bot.
ALTER TABLE public.st_streamers
  ADD COLUMN IF NOT EXISTS kick_last_chat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twitch_last_chat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_st_cooldowns_used_at ON public.st_cooldowns (used_at);

-- La PK serializa reservas concurrentes. Solo una petición obtiene el turno.
CREATE OR REPLACE FUNCTION public.st_take_cooldown(p_key TEXT, p_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE claimed BOOLEAN;
BEGIN
  IF p_key IS NULL OR p_key = '' OR p_seconds IS NULL OR p_seconds < 1 THEN
    RETURN false;
  END IF;
  -- Los recibos de eventos antiguos no deben crecer indefinidamente.
  DELETE FROM public.st_cooldowns
    WHERE key LIKE 'event:%' AND used_at < clock_timestamp() - interval '2 days';
  INSERT INTO public.st_cooldowns AS existing (key, used_at)
    VALUES (p_key, clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET used_at = EXCLUDED.used_at
    WHERE existing.used_at <= EXCLUDED.used_at - make_interval(secs => p_seconds)
  RETURNING true INTO claimed;
  RETURN COALESCE(claimed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.st_take_cooldown(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.st_take_cooldown(TEXT, INTEGER) TO service_role;
