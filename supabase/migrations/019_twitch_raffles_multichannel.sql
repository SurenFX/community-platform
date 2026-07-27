-- Migración 019: sorteos de Twitch multi-canal

-- 1. Agregar canal a twitch_raffles
--    Identifica en qué canal de Twitch corre el sorteo (login del streamer)
ALTER TABLE public.twitch_raffles
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'salchinft';

-- Índice para buscar el sorteo activo de un canal específico
CREATE INDEX IF NOT EXISTS idx_twitch_raffles_channel_status
  ON public.twitch_raffles(channel, status);

-- 2. Vincular usuario del Hub como dueño del canal en friend_streamers
--    Se llena automáticamente cuando el streamer conecta su Twitch en configuración
ALTER TABLE public.friend_streamers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
