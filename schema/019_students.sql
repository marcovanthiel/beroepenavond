-- Sessie 7 — leerling-accounts (los van het beheer). Magic-link login.

CREATE TABLE IF NOT EXISTS students (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  school      TEXT,
  profiel     TEXT,                              -- bv. N&T, E&M, vmbo-techniek
  newsletter  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login  INTEGER
);

-- Magic-link tokens (eenmalig, kort geldig).
CREATE TABLE IF NOT EXISTS student_tokens (
  token       TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS student_tokens_exp_idx ON student_tokens(expires_at);

-- Ingelogde sessies (cookie).
CREATE TABLE IF NOT EXISTS student_logins (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS student_logins_exp_idx ON student_logins(expires_at);

-- Gekozen beroepen (later te matchen met het rooster/sessies).
CREATE TABLE IF NOT EXISTS student_picks (
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  beroep_id   INTEGER NOT NULL REFERENCES beroepen(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, beroep_id)
);

-- Interesse-vakgebieden (voor aanbevelingen).
CREATE TABLE IF NOT EXISTS student_interests (
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, category_id)
);

-- Vraag vooraf aan een beroep/voorlichter.
CREATE TABLE IF NOT EXISTS student_questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  TEXT REFERENCES students(id) ON DELETE SET NULL,
  beroep_id   INTEGER REFERENCES beroepen(id) ON DELETE SET NULL,
  question    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS student_questions_status_idx ON student_questions(status);
