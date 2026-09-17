-- 031_voorlichter_tijdvak.sql
-- Beschikbaarheid en voorkeur van een voorlichter per tijdvak (ronde), voor de
-- automatische sessie-indeling. Eén rij per (voorlichter, ronde):
--   status 'nee'      = kan NIET in dit tijdvak (harde beperking)
--   status 'voorkeur' = voorkeur voor dit tijdvak (zacht, weegt mee)
-- Geen rij = beschikbaar, neutraal. De voorlichter geeft dit op in het
-- aanmeldformulier en later in zijn portaal (tokenlink); de relatiebeheerder
-- kan het ook inzien/bewerken.
CREATE TABLE IF NOT EXISTS speaker_round_prefs (
  speaker_id TEXT NOT NULL,
  round_id   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'nee',
  PRIMARY KEY (speaker_id, round_id)
);
CREATE INDEX IF NOT EXISTS idx_srp_round ON speaker_round_prefs(round_id);
