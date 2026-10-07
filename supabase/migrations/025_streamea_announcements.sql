BEGIN;

CREATE TABLE IF NOT EXISTS public.st_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id UUID NOT NULL REFERENCES public.st_streamers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'KICK' CHECK (platform = 'KICK'),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 400),
  interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (interval_minutes BETWEEN 5 AND 1440),
  min_messages INTEGER NOT NULL DEFAULT 5 CHECK (min_messages BETWEEN 5 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count BETWEEN 0 AND 100),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.st_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "streamer administra sus avisos" ON public.st_announcements;
CREATE POLICY "streamer administra sus avisos" ON public.st_announcements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.st_streamers s WHERE s.id = streamer_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.st_streamers s WHERE s.id = streamer_id AND s.user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.st_announcements TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_st_announcements_channel ON public.st_announcements(streamer_id, platform) WHERE is_active;

-- Una reserva por canal: cuenta actividad y devuelve como máximo un aviso.
-- Los fallos de envío consumen el turno, evitando reintentos en cada mensaje.
CREATE OR REPLACE FUNCTION public.st_claim_announcement(p_streamer_id UUID, p_platform TEXT)
RETURNS TABLE(id UUID, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_platform <> 'KICK' OR NOT EXISTS (
    SELECT 1 FROM public.st_streamers s WHERE s.id = p_streamer_id AND s.is_active
  ) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_streamer_id::text || ':' || p_platform, 0));
  UPDATE public.st_announcements a SET message_count = LEAST(a.message_count + 1, 100)
    WHERE a.streamer_id = p_streamer_id AND a.platform = p_platform AND a.is_active;
  -- Evita que varios avisos vencidos se publiquen juntos.
  IF EXISTS (SELECT 1 FROM public.st_announcements a
    WHERE a.streamer_id = p_streamer_id AND a.platform = p_platform
      AND a.last_attempt_at > v_now - interval '1 minute') THEN RETURN; END IF;
  SELECT a.id INTO v_id FROM public.st_announcements a
    WHERE a.streamer_id = p_streamer_id AND a.platform = p_platform AND a.is_active
      AND a.message_count >= a.min_messages
      AND a.last_attempt_at <= v_now - make_interval(mins => a.interval_minutes)
    ORDER BY a.last_attempt_at, a.id LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.st_announcements a
    SET last_attempt_at = v_now, message_count = 0
    WHERE a.id = v_id RETURNING a.id, a.message;
END;
$$;
REVOKE ALL ON FUNCTION public.st_claim_announcement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.st_claim_announcement(UUID, TEXT) TO service_role;
COMMIT;
