-- Streamea etapa 3: comandos custom por streamer + token global del bot
-- Correr en el SQL Editor del proyecto NUEVO de Supabase.

-- Comandos de chat configurables desde el panel, por streamer
CREATE TABLE IF NOT EXISTS st_commands (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  streamer_id      UUID NOT NULL REFERENCES st_streamers(id) ON DELETE CASCADE,
  command          TEXT NOT NULL,              -- guardado siempre en minusculas, con "!"
  response         TEXT NOT NULL,
  cooldown_seconds INT  NOT NULL DEFAULT 30,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  uses             INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (streamer_id, command)
);

ALTER TABLE st_commands ENABLE ROW LEVEL SECURITY;

-- El streamer maneja (lee/crea/edita/borra) solo sus comandos
CREATE POLICY "streamer lee sus comandos" ON st_commands
  FOR SELECT USING (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );
CREATE POLICY "streamer crea sus comandos" ON st_commands
  FOR INSERT WITH CHECK (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );
CREATE POLICY "streamer edita sus comandos" ON st_commands
  FOR UPDATE USING (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );
CREATE POLICY "streamer borra sus comandos" ON st_commands
  FOR DELETE USING (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );

-- El streamer tambien maneja sus sorteos desde el panel (antes solo habia SELECT)
CREATE POLICY "streamer crea sus sorteos" ON st_raffles
  FOR INSERT WITH CHECK (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );
CREATE POLICY "streamer edita sus sorteos" ON st_raffles
  FOR UPDATE USING (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );
CREATE POLICY "streamer borra sus sorteos" ON st_raffles
  FOR DELETE USING (
    streamer_id IN (SELECT id FROM st_streamers WHERE user_id = auth.uid())
  );

-- Marca de si el bot ya fue confirmado como moderador del canal (para el onboarding)
ALTER TABLE st_streamers ADD COLUMN IF NOT EXISTS bot_is_mod BOOLEAN NOT NULL DEFAULT false;
