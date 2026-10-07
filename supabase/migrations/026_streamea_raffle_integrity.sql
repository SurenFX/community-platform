BEGIN;

CREATE OR REPLACE FUNCTION public.st_open_raffle(p_streamer_id UUID, p_platform TEXT, p_keyword TEXT)
RETURNS TABLE(id UUID) LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_platform IS NULL OR p_platform NOT IN ('KICK','TWITCH') OR p_keyword IS NULL
    OR char_length(p_keyword) NOT BETWEEN 1 AND 40 OR p_keyword ~ '\s' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.st_streamers s WHERE s.id = p_streamer_id AND s.is_active
    AND CASE p_platform WHEN 'KICK' THEN s.kick_user_id IS NOT NULL ELSE s.twitch_user_id IS NOT NULL END)
    THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('raffle:' || p_streamer_id::text, 0));
  -- Un segundo clic no reemplaza ni vuelve a anunciar un sorteo abierto.
  IF EXISTS (SELECT 1 FROM public.st_raffles r WHERE r.streamer_id = p_streamer_id AND r.status = 'active')
    THEN RETURN; END IF;
  RETURN QUERY INSERT INTO public.st_raffles(streamer_id,platform,keyword,status)
    VALUES(p_streamer_id,p_platform,p_keyword,'active') RETURNING st_raffles.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.st_enter_raffle(p_streamer_id UUID, p_platform TEXT, p_username TEXT, p_content TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_inserted UUID;
BEGIN
  IF p_username IS NULL OR char_length(btrim(p_username)) NOT BETWEEN 1 AND 64 THEN RETURN false; END IF;
  SELECT r.id INTO v_id FROM public.st_raffles r
    WHERE r.streamer_id = p_streamer_id AND r.platform = p_platform AND r.status = 'active'
      AND lower(btrim(r.keyword)) = lower(btrim(p_content))
    ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.st_raffle_entries(raffle_id,username)
    VALUES(v_id,lower(btrim(p_username))) ON CONFLICT(raffle_id,username) DO NOTHING RETURNING id INTO v_inserted;
  RETURN v_inserted IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.st_draw_raffle(p_streamer_id UUID, p_raffle_id UUID)
RETURNS TABLE(winner TEXT, platform TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_platform TEXT; v_winner TEXT;
BEGIN
  -- El bloqueo también serializa entradas y cierres mientras se elige ganador.
  SELECT r.platform INTO v_platform FROM public.st_raffles r
    WHERE r.id = p_raffle_id AND r.streamer_id = p_streamer_id AND r.status = 'active' FOR UPDATE;
  IF v_platform IS NULL THEN RETURN; END IF;
  -- UUID aleatorio evita depender de Math.random y no limita participantes a una página.
  SELECT e.username INTO v_winner FROM public.st_raffle_entries e
    WHERE e.raffle_id = p_raffle_id ORDER BY gen_random_uuid() LIMIT 1;
  IF v_winner IS NULL THEN RETURN; END IF;
  UPDATE public.st_raffles r SET status='drawn', winner=v_winner, closed_at=now() WHERE r.id=p_raffle_id;
  RETURN QUERY SELECT v_winner, v_platform;
END;
$$;

REVOKE ALL ON FUNCTION public.st_open_raffle(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.st_enter_raffle(UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.st_draw_raffle(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.st_open_raffle(UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.st_enter_raffle(UUID,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.st_draw_raffle(UUID,UUID) TO service_role;
COMMIT;
