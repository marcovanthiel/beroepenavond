-- Inlogcodes (6 cijfers) voor passwordless admin-login.
-- Eén actieve code per e-mail; gehasht opgeslagen. Login kan alleen voor
-- e-mailadressen die als `users`-account bestaan (door admin aangemaakt).
CREATE TABLE IF NOT EXISTS admin_login_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,   -- epoch seconden
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
