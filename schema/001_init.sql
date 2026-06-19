-- ============================================================
-- Beroepenavond Nijmegen — D1 schema
-- ============================================================
-- Eénmalig draaien tegen de D1-database:
--   wrangler d1 execute beroepenavond --remote --file=schema/001_init.sql

-- ============================================================
-- Auth & beheer
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor',  -- 'admin' | 'editor'
  pw_hash       TEXT NOT NULL,
  reset_token   TEXT,
  reset_expires INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  -- Login-sessies (cookies), niet beroepssessies.
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    TEXT,  -- JSON
  ip_address  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at);

-- ============================================================
-- Site-content
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  -- Key/value voor stichting-gegevens die overal terugkomen (datum,
  -- locatie, contact). {{kvk}}-style placeholders in pages worden voor
  -- render vervangen.
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pages (
  -- Statische publieke pagina's (introductie, tijdschema, uitleg).
  slug             TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  meta_description TEXT,
  hero_eyebrow     TEXT,
  hero_title       TEXT,
  hero_lede        TEXT,
  hero_image       TEXT,
  body_md          TEXT NOT NULL DEFAULT '',
  nav_order        INTEGER NOT NULL DEFAULT 100,
  nav_label        TEXT,  -- afwijkende nav-label; default = title
  is_published     INTEGER NOT NULL DEFAULT 1,
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- Evenement-domein
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  -- Eén rij per jaarlijkse avond. Actieve event = is_active=1.
  id              TEXT PRIMARY KEY,
  year            INTEGER NOT NULL,
  title           TEXT NOT NULL,
  date            TEXT NOT NULL,           -- ISO YYYY-MM-DD
  venue_name      TEXT NOT NULL,
  venue_address   TEXT,
  intro_md        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS events_year_idx ON events(year);

CREATE TABLE IF NOT EXISTS rounds (
  -- Voorlichtingsrondes binnen één avond (bv. 19:00–19:25, 19:35–20:00).
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round_no      INTEGER NOT NULL,
  start_time    TEXT NOT NULL,             -- "19:00"
  end_time      TEXT NOT NULL,             -- "19:25"
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS rounds_event_idx ON rounds(event_id, round_no);

CREATE TABLE IF NOT EXISTS categories (
  -- Beroepscategorieën (Creatief, Gezondheidszorg, etc.). Stabiele
  -- volgorde via sort_order; kleurcode voor de plattegrond/legenda.
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,                        -- hex #RRGGBB
  sort_order  INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS speakers (
  -- Voorlichters / sprekers. Eén rij per persoon, kan meerdere
  -- sessies geven binnen één avond.
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  organization    TEXT,                    -- werkgever
  job_title       TEXT,
  bio_md          TEXT,
  portrait_url    TEXT,                    -- URL naar R2 / extern
  website         TEXT,
  is_public       INTEGER NOT NULL DEFAULT 1,  -- toon op publieke site
  notes           TEXT,                    -- niet-publiek
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS speakers_name_idx ON speakers(full_name);

CREATE TABLE IF NOT EXISTS classrooms (
  -- Lokalen in de school waar sessies plaatsvinden.
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,               -- "A1.12" / "Aula"
  name        TEXT,                        -- vrije naam
  floor       TEXT,                        -- "Begane grond" / "1e verdieping"
  capacity    INTEGER,
  -- Plattegrond-koppeling: SVG polygon of cirkel-coords (JSON).
  -- Bv. { "shape": "rect", "x": 220, "y": 140, "w": 80, "h": 50 }
  -- of   { "shape": "polygon", "points": "10,20 30,40 50,60" }
  map_shape   TEXT,
  map_floor   TEXT,                        -- "begane-grond" / "1e" (matched een floorplan)
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS classrooms_event_idx ON classrooms(event_id);

CREATE TABLE IF NOT EXISTS floorplans (
  -- Eén of meerdere plattegronden (per verdieping bv).
  id             TEXT PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  floor_slug     TEXT NOT NULL,            -- "begane-grond"
  floor_label    TEXT NOT NULL,            -- "Begane grond"
  image_url      TEXT NOT NULL,            -- R2-key of externe URL
  viewbox        TEXT NOT NULL DEFAULT '0 0 1000 600',  -- SVG viewBox
  sort_order     INTEGER NOT NULL DEFAULT 100
);
CREATE INDEX IF NOT EXISTS floorplans_event_idx ON floorplans(event_id, sort_order);

CREATE TABLE IF NOT EXISTS sessions_program (
  -- Eén beroepssessie binnen één avond, in één lokaal, één ronde,
  -- één of meerdere sprekers.
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  classroom_id    TEXT REFERENCES classrooms(id) ON DELETE SET NULL,
  round_id        TEXT REFERENCES rounds(id) ON DELETE SET NULL,
  profession      TEXT NOT NULL,           -- "Architect"
  title           TEXT,                    -- presentatie-titel
  description_md  TEXT,
  is_public       INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS sessions_event_idx ON sessions_program(event_id);
CREATE INDEX IF NOT EXISTS sessions_category_idx ON sessions_program(category_id);
CREATE INDEX IF NOT EXISTS sessions_classroom_idx ON sessions_program(classroom_id);
CREATE INDEX IF NOT EXISTS sessions_round_idx ON sessions_program(round_id);

CREATE TABLE IF NOT EXISTS session_speakers (
  -- Many-to-many: sessie ↔ spreker(s).
  session_id   TEXT NOT NULL REFERENCES sessions_program(id) ON DELETE CASCADE,
  speaker_id   TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, speaker_id)
);
CREATE INDEX IF NOT EXISTS session_speakers_speaker_idx ON session_speakers(speaker_id);
