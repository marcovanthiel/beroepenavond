-- Sessie 6 — spreker-bevestiging, sponsoren, publicatie-schakelaar.

-- Bevestiging: een spreker wordt pas publiek getoond als 'confirmed=1'
-- ÉN de globale schakelaar 'voorlichters_published' aan staat.
ALTER TABLE speakers ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE speakers ADD COLUMN confirmed_at INTEGER;
CREATE INDEX IF NOT EXISTS speakers_confirmed_idx ON speakers(confirmed);

-- Sponsoren (meerdere; met logo + link).
CREATE TABLE IF NOT EXISTS sponsors (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  website     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS sponsors_active_idx ON sponsors(is_active, sort_order);

-- Globale publicatie-schakelaar voor de voorlichters (default: uit).
INSERT OR IGNORE INTO settings (key, value) VALUES ('voorlichters_published', '0');

-- Bestaande sponsor (Schrofenblick) overzetten naar de nieuwe tabel.
INSERT OR IGNORE INTO sponsors (id, name, logo_url, website, sort_order, is_active) VALUES
  ('spn_schrofenblick', 'Schrofenblick Alpen Resort', '/assets/img/schrofenblick.png', 'https://www.resort-schrofenblick.at/', 10, 1);
