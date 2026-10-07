BEGIN;
CREATE TABLE IF NOT EXISTS public.st_social_destinations (
  streamer_id UUID NOT NULL REFERENCES public.st_streamers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('DISCORD','TELEGRAM')),
  encrypted_config TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (streamer_id,platform)
);
ALTER TABLE public.st_social_destinations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.st_social_destinations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.st_social_destinations TO service_role;
ALTER TABLE public.st_announcements DROP CONSTRAINT IF EXISTS st_announcements_platform_check;
ALTER TABLE public.st_announcements ADD CONSTRAINT st_announcements_platform_check CHECK (platform IN ('KICK','TWITCH','DISCORD','TELEGRAM'));
CREATE OR REPLACE FUNCTION public.st_claim_announcement(p_streamer_id UUID, p_platform TEXT)
RETURNS TABLE(id UUID, message TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_platform IS NULL OR p_platform NOT IN ('KICK','TWITCH','DISCORD','TELEGRAM') OR NOT EXISTS (
    SELECT 1 FROM public.st_streamers s WHERE s.id = p_streamer_id AND s.is_active
  ) THEN RETURN; END IF;
  IF p_platform IN ('DISCORD','TELEGRAM') AND NOT EXISTS (SELECT 1 FROM public.st_social_destinations d WHERE d.streamer_id=p_streamer_id AND d.platform=p_platform AND d.is_active) THEN RETURN; END IF;
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
