-- ============================================================
-- Beroepenavond Nijmegen — uitbreiding (sessie 3)
-- Formulier-inzendingen, nieuwsbrief, nieuws + extra settings.
-- Idempotent: CREATE IF NOT EXISTS + INSERT OR IGNORE.
-- ============================================================

-- Inzendingen: contactformulier én voorlichter-aanmeldingen.
CREATE TABLE IF NOT EXISTS submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,                 -- 'contact' | 'volunteer'
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  organization TEXT,
  profession   TEXT,                          -- voorlichter: welk beroep
  message      TEXT,
  payload      TEXT,                          -- JSON met extra velden
  status       TEXT NOT NULL DEFAULT 'new',   -- 'new'|'read'|'handled'|'archived'
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS submissions_type_idx ON submissions(type);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions(status);
CREATE INDEX IF NOT EXISTS submissions_created_idx ON submissions(created_at);

-- Nieuwsbrief-abonnees (light double opt-in via confirm_token).
CREATE TABLE IF NOT EXISTS subscribers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'active'|'unsubscribed'
  token         TEXT,                            -- bevestigen + uitschrijven
  confirmed_at  INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers(status);

-- Nieuws / aankondigingen.
CREATE TABLE IF NOT EXISTS announcements (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  summary       TEXT,
  body_md       TEXT NOT NULL DEFAULT '',
  cover_url     TEXT,
  is_published  INTEGER NOT NULL DEFAULT 1,
  published_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS announcements_pub_idx ON announcements(is_published, published_at);

-- Extra settings (INSERT OR IGNORE: bestaande waarden blijven staan).
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('mail_enabled',      '1'),
  ('mail_from',         'Beroepenavond Nijmegen <noreply@inijmegen.com>'),
  ('mail_to',           'info@beroepenavondnijmegen.nl'),
  ('mail_reply_to',     'info@beroepenavondnijmegen.nl'),
  ('org_phone',         ''),
  ('edition_number',    '25e'),
  ('expected_visitors', '4.000'),
  ('expected_professions','70'),
  ('expected_speakers', '90'),
  ('social_facebook',   ''),
  ('social_instagram',  ''),
  ('social_linkedin',   ''),
  ('site_tagline',      'Ontdek meer dan 70 beroepen op één avond'),
  ('intro_short',       'Rotary Club Nijmegen-Stad en Land organiseert samen met de decanen van de middelbare scholen in Nijmegen e.o. en het Canisius College jaarlijks de Beroepenavond.');
