-- Migración 009: tabla para guardar sorteos de YouTube
CREATE TABLE IF NOT EXISTS youtube_raffles (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id            text        NOT NULL,
  video_title         text,
  video_url           text,
  winner_youtube_name text        NOT NULL,
  winner_comment      text,
  winner_comment_url  text,
  winner_photo_url    text,
  total_participants  int         DEFAULT 0,
  drawn_at            timestamptz DEFAULT now()
);

-- RLS: solo admins pueden insertar/leer desde server
ALTER TABLE youtube_raffles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON youtube_raffles USING (true) WITH CHECK (true);
