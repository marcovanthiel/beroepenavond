-- Inkomende mail (Email Routing → Worker): eigen postvak op de site.
-- Domein-neutraal: adressen worden opgeslagen zoals ontvangen; er staat
-- nergens een domeinnaam hard in schema of code.

CREATE TABLE IF NOT EXISTS mail_inbox (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id   TEXT,                    -- Message-ID-header (voor threading)
  from_email   TEXT NOT NULL,
  from_name    TEXT,
  to_email     TEXT NOT NULL,           -- op welk adres kwam hij binnen
  subject      TEXT,
  body_text    TEXT,                    -- platte tekst (weergave in beheer)
  attachments  TEXT NOT NULL DEFAULT '[]',  -- JSON [{key,filename,size,blocked}]
  status       TEXT NOT NULL DEFAULT 'nieuw',   -- nieuw|gelezen|afgehandeld
  speaker_id   TEXT,                    -- automatische koppeling op afzender
  received_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  answered_at  INTEGER
);
CREATE INDEX IF NOT EXISTS mail_inbox_status ON mail_inbox(status, received_at);

-- Audit van élke binnenkomende mail, ook geweigerde (les: nooit stil).
CREATE TABLE IF NOT EXISTS mail_inbox_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_email  TEXT,
  to_email    TEXT,
  subject     TEXT,
  outcome     TEXT NOT NULL,            -- opgenomen|bijlage_geblokkeerd|fout
  detail      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
