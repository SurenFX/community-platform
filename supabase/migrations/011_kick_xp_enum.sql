-- Migración 011: agrega los nuevos event_type de Kick al enum xp_event_type.
--
-- IMPORTANTE: ejecutar este archivo SOLO (como su propio "Run" en el SQL Editor de
-- Supabase) y esperar que termine, ANTES de correr 012_kick_missions_badges_seed.sql.
-- Postgres no permite usar un valor de enum recién agregado dentro de la misma
-- transacción en la que se agregó -- por eso esto va separado del seed de
-- xp_config/missions/badges que sí usa estos valores nuevos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'xp_event_type' AND typtype = 'e'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'xp_event_type' AND e.enumlabel = 'KICK_CHAT_MESSAGE'
    ) THEN
      ALTER TYPE xp_event_type ADD VALUE 'KICK_CHAT_MESSAGE';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'xp_event_type' AND e.enumlabel = 'KICK_FOLLOW'
    ) THEN
      ALTER TYPE xp_event_type ADD VALUE 'KICK_FOLLOW';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'xp_event_type' AND e.enumlabel = 'KICK_SUBSCRIBE'
    ) THEN
      ALTER TYPE xp_event_type ADD VALUE 'KICK_SUBSCRIBE';
    END IF;
  END IF;
  -- Si 'platform' / 'event_type' son CHECK constraints en vez de enums en tu base,
  -- este bloque no hace nada -- agregá los valores a mano a esas listas.
END $$;
