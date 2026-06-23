-- Tabla de links de referido por juego
-- El admin carga nombre, imagen, URL de referido y orden
-- click_count se incrementa desde el server action cada vez que un usuario hace clic

CREATE TABLE IF NOT EXISTS referral_links (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name     TEXT        NOT NULL,
  game_image_url TEXT       NOT NULL,
  referral_url  TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  click_count   INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo admins escriben, cualquier usuario autenticado puede leer activos
ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_links_select" ON referral_links
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "referral_links_admin_all" ON referral_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Índice de orden de presentación
CREATE INDEX IF NOT EXISTS referral_links_sort_order_idx ON referral_links(sort_order, created_at);
