-- Procesinrichting (sept 2026): mail-outbox met 9:30-verzending, bewerkbare
-- mailteksten, voorlichter-uitnodigingen met herinnering, evaluaties,
-- leerling-tijdblokken en automatische indeling, sponsor-interesse.

CREATE TABLE IF NOT EXISTS mail_templates (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,             -- weergavenaam in beheer
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,             -- alinea's; placeholders {{...}}
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dedup_key     TEXT UNIQUE,             -- idempotente planners
  template_key  TEXT NOT NULL,
  to_email      TEXT NOT NULL,
  payload       TEXT NOT NULL DEFAULT '{}',
  scheduled_for INTEGER NOT NULL,        -- unix; cron verstuurt wat 'due' is
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed|geannuleerd
  error         TEXT,
  sent_at       INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS mail_outbox_due ON mail_outbox(status, scheduled_for);

CREATE TABLE IF NOT EXISTS speaker_invites (
  token        TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  name         TEXT,
  speaker_id   TEXT REFERENCES speakers(id) ON DELETE CASCADE,  -- gezet bij 'herhaal'
  kind         TEXT NOT NULL DEFAULT 'nieuw',   -- nieuw|herhaal
  status       TEXT NOT NULL DEFAULT 'open',    -- open|aangemeld
  invited_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  reminded_at  INTEGER,
  responded_at INTEGER
);
CREATE INDEX IF NOT EXISTS speaker_invites_status ON speaker_invites(status, invited_at);

CREATE TABLE IF NOT EXISTS speaker_eval_tokens (
  token      TEXT PRIMARY KEY,
  speaker_id TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(speaker_id, event_id)
);

CREATE TABLE IF NOT EXISTS speaker_evaluations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  speaker_id         TEXT NOT NULL,
  event_id           TEXT NOT NULL,
  counts             TEXT,               -- JSON { session_id: aantal deelnemers }
  total_participants INTEGER,
  questions          TEXT,               -- welke vragen kreeg je
  remarks            TEXT,               -- opmerkingen/tips
  again              TEXT,               -- ja|misschien|nee
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(speaker_id, event_id)
);

CREATE TABLE IF NOT EXISTS student_blocked_rounds (
  student_id TEXT NOT NULL,
  round_id   TEXT NOT NULL,
  PRIMARY KEY (student_id, round_id)
);

CREATE TABLE IF NOT EXISTS student_schedule (
  student_id TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  round_id   TEXT NOT NULL,
  session_id TEXT NOT NULL,
  PRIMARY KEY (student_id, event_id, round_id)
);
CREATE INDEX IF NOT EXISTS student_schedule_session ON student_schedule(session_id);

ALTER TABLE speakers ADD COLUMN sponsor_interest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN sponsor_interest INTEGER NOT NULL DEFAULT 0;

-- Standaard-mailteksten (bewerkbaar in beheer → Mails). Placeholders:
-- {{voornaam}} {{naam}} {{beroep}} {{datum}} {{locatie}} {{rooster}}
-- {{knop}} (wordt de zwarte knop) {{stats}}.
INSERT OR IGNORE INTO mail_templates (key, name, subject, body) VALUES
('vl_uitnodiging_nieuw', 'Voorlichter: uitnodiging (nieuw)',
 'Doe je mee met de Beroepenavond Nijmegen?',
 'Beste {{naam}},

Op {{datum}} organiseren wij de Beroepenavond in {{locatie}}: honderden scholieren maken die avond kennis met de mensen achter ruim honderd beroepen. Wij zouden het geweldig vinden als jij jouw vak komt presenteren.

Het kost je één avond en levert je het beste publiek op dat er bestaat: jongeren die alles durven te vragen.

{{knop}}

Via de knop vul je in een paar minuten je gegevens in. Reageren voor onze planning het liefst binnen een week.'),
('vl_uitnodiging_herhaal', 'Voorlichter: uitnodiging (vorig jaar)',
 'Doe je dit jaar weer mee met de Beroepenavond?',
 'Beste {{naam}},

Vorig jaar stond je als voorlichter op de Beroepenavond Nijmegen en daar zijn we je nog steeds dankbaar voor. Op {{datum}} organiseren we de volgende editie in {{locatie}}, en we hopen dat je er weer bij bent.

{{knop}}

Via de knop bevestig je je deelname en controleer je in één oogopslag of je gegevens nog kloppen. Het kost je hooguit twee minuten.'),
('vl_herinnering', 'Voorlichter: herinnering uitnodiging',
 'Herinnering: doe je mee met de Beroepenavond?',
 'Beste {{naam}},

Vorige week stuurden we je een uitnodiging voor de Beroepenavond Nijmegen op {{datum}}. Misschien is die mail aan je aandacht ontsnapt, daarom deze vriendelijke herinnering.

{{knop}}

We horen graag of je erbij bent; ook een "dit jaar niet" is welkom, dan weten wij waar we aan toe zijn.'),
('vl_indeling', 'Voorlichter: indeling (rooster + lokaal)',
 'Je indeling voor de Beroepenavond op {{datum}}',
 'Beste {{naam}},

De indeling voor de Beroepenavond is klaar. Jij bent ingedeeld:

{{rooster}}

Praktisch, zo verloopt je avond:

1. Meld je bij binnenkomst bij de aanmeldbalie; daar liggen je badge en het programma voor je klaar.
2. Loop daarna door naar de lerarenkamer: daar staan koffie, thee en iets lekkers, en tref je de andere voorlichters en de organisatie.
3. Zorg dat je ruim voor je eerste ronde in je lokaal bent; een gastheer of gastvrouw wijst je de weg.

Na afloop vragen we je een korte enquête in te vullen over je sessies; je krijgt daarvoor op de avond zelf een mail met een link. Alvast bedankt!

Tot {{datum}}!'),
('vl_eventdag', 'Voorlichter: ochtend van de avond',
 'Vanavond is het zover!',
 'Beste {{naam}},

Vanavond is het zover: de Beroepenavond in {{locatie}}! Honderden scholieren kijken uit naar jouw verhaal, en wij ook. We hebben er ontzettend veel zin in.

We wensen je vandaag een mooie (werk)dag toe. Tot vanavond!'),
('vl_evaluatie', 'Voorlichter: evaluatieformulier',
 'Hoe waren je sessies? Deel het in 2 minuten',
 'Beste {{naam}},

Je eerste sessie is achter de rug! Zou je (vanavond of morgen) het korte evaluatieformulier willen invullen? Je vult per sessie het aantal deelnemers in, welke vragen je kreeg en of je er volgend jaar weer bij wilt zijn.

{{knop}}

Bedankt, ook namens de scholieren!'),
('vl_bedankt', 'Voorlichter: bedankmail na afloop',
 'Bedankt voor je bijdrage aan de Beroepenavond!',
 'Beste {{naam}},

Wat was het een mooie avond! Namens de hele organisatie en alle scholieren: hartelijk dank dat je jouw vak bent komen presenteren.

{{stats}}

We hopen je volgend jaar weer te mogen begroeten. Reserveer de datum alvast zodra die bekend is; je hoort van ons.

Hartelijke groet,
Organisatie Beroepenavond Nijmegen'),
('ll_indeling', 'Leerling: jouw rooster staat klaar',
 'Jouw avond staat klaar!',
 'Hoi {{voornaam}},

Goed nieuws: jouw persoonlijke rooster voor de Beroepenavond op {{datum}} staat klaar. Dit is je avond:

{{rooster}}

{{knop}}

Klopt er iets niet of wil je wisselen? Log in bij Mijn avond en pas je voorkeuren aan, of spreek je decaan aan.'),
('ll_eventdag', 'Leerling: morgen is het zover',
 'Morgen is het zover!',
 'Hoi {{voornaam}},

Morgen is de Beroepenavond! Neem je telefoon mee (daar staat je rooster op), kom op tijd naar {{locatie}} en stel vooral de vragen die je écht wilt stellen. De voorlichters hebben er zin in, wij ook.

Tot morgen!'),
('ll_bedankt', 'Leerling: bedankt na afloop',
 'Bedankt voor je bezoek aan de Beroepenavond!',
 'Hoi {{voornaam}},

Leuk dat je op de Beroepenavond was! We hopen dat de gesprekken je verder helpen bij het kiezen van je richting.

{{stats}}

Weet je al welke kant je op wilt, of juist niet? Beide zijn winst. Volgend jaar is er weer een editie; tot dan!');
