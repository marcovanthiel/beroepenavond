-- Tabel voor de individuele beroepen per categorie.
-- Vrij eenvoudig: één rij per beroep, met FK naar categories.

CREATE TABLE IF NOT EXISTS beroepen (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT,            -- voor #anchor in /uitleg-beroepen
  sort_order   INTEGER NOT NULL DEFAULT 0,
  description_md TEXT           -- optionele uitleg voor /uitleg-beroepen
);

CREATE INDEX IF NOT EXISTS idx_beroepen_cat ON beroepen(category_id, sort_order);

-- Seed: alle beroepen uit het 2025-overzicht, per categorie.
-- Categorieën zijn alfabetisch binnen elke groep.

DELETE FROM beroepen;

INSERT INTO beroepen (category_id, name, sort_order) VALUES
  -- Creatieve beroepen
  ('cat_creatief', 'Architect',                                10),
  ('cat_creatief', 'Architect & Bouwkundig Ingenieur',         20),
  ('cat_creatief', 'Fotograaf / Vormgever',                    30),
  ('cat_creatief', 'Grafisch vormgever',                       40),
  ('cat_creatief', 'Landschapsontwerper',                      50),
  ('cat_creatief', 'Stedenbouwkundige',                        60),
  ('cat_creatief', 'Webdeveloper & Digital Solutions Expert',  70),

  -- Gezondheidszorg en welzijn
  ('cat_zorg', 'Anesthesiemedewerker',                          10),
  ('cat_zorg', 'Apotheker en apothekerassistent',               20),
  ('cat_zorg', 'Bedrijfsarts',                                  30),
  ('cat_zorg', 'Dierenarts',                                    40),
  ('cat_zorg', 'Doktersassistent',                              50),
  ('cat_zorg', 'Fysiotherapeut',                                60),
  ('cat_zorg', 'Gezinscoach',                                   70),
  ('cat_zorg', 'Huisarts',                                      80),
  ('cat_zorg', 'Kinderarts',                                    90),
  ('cat_zorg', 'Klinisch Psycholoog en Psychotherapeut',       100),
  ('cat_zorg', 'Logopedist',                                   110),
  ('cat_zorg', 'Medisch Beeldvormings- en Bestralingsdeskundige (MBB''er)', 120),
  ('cat_zorg', 'Medisch specialist / orthopaedie',             130),
  ('cat_zorg', 'Mondhygiënist',                                140),
  ('cat_zorg', 'Operatieassistent',                            150),
  ('cat_zorg', 'Orthodontist',                                 160),
  ('cat_zorg', 'Psychiater',                                   170),
  ('cat_zorg', 'Psychologen in de Verslavingszorg',            180),
  ('cat_zorg', 'Specialist ouderengeneeskunde',                190),
  ('cat_zorg', 'Sportondernemer en coach',                     200),
  ('cat_zorg', 'Tandarts en tandartsassistente',               210),
  ('cat_zorg', 'Verpleegkundig specialist Psychiatrie',        220),
  ('cat_zorg', 'Wetenschappelijk onderzoek geneeskunde',       230),

  -- Handel, economie & zakelijke dienstverlening
  ('cat_handel', 'Accountant',                                  10),
  ('cat_handel', 'Adviseur Brandveiligheid',                    20),
  ('cat_handel', 'Advocaat',                                    30),
  ('cat_handel', 'Econoom / Bedrijfskundige',                   40),
  ('cat_handel', 'Event Management',                            50),
  ('cat_handel', 'Facilitair medewerker',                       60),
  ('cat_handel', 'FIOD / Accountant/controlemedewerker',        70),
  ('cat_handel', 'Fiscaal Jurist & Accountant/controlemedewerker', 80),
  ('cat_handel', 'Fiscalist',                                   90),
  ('cat_handel', 'Gerechtsdeurwaarder',                        100),
  ('cat_handel', 'Hotel- & Restaurant manager',                110),
  ('cat_handel', 'HR-adviseur',                                120),
  ('cat_handel', 'HR-medewerker',                              130),
  ('cat_handel', 'Makelaar',                                   140),
  ('cat_handel', 'Marketing- & Communicatie manager',          150),
  ('cat_handel', 'Notaris',                                    160),
  ('cat_handel', 'Sales manager (B-to-B)',                     170),

  -- Maatschappelijke dienstverlening / uniformberoepen
  ('cat_maats', 'Defensie',                                     10),
  ('cat_maats', 'Defensie Tactical Control Officer (TCO)',      20),
  ('cat_maats', 'Politie / Dierenpolitie',                      30),
  ('cat_maats', 'Rechercheur',                                  40),

  -- Onderwijs & communicatie
  ('cat_onderwijs', 'Docent Duits middelbare school',           10),
  ('cat_onderwijs', 'Docent middelbare school',                 20),
  ('cat_onderwijs', 'Journalist',                               30),
  ('cat_onderwijs', 'Leerkracht basisonderwijs',                40),
  ('cat_onderwijs', 'Onderzoeker / Professor',                  50),
  ('cat_onderwijs', 'Opleider Praktijkleren Radboud UMC',       60),

  -- Techniek
  ('cat_techniek', 'Audiovisueel specialist / Theatertechnicus', 10),
  ('cat_techniek', 'Civiel ingenieur',                          20),
  ('cat_techniek', 'Cyber Security & AI Specialist',            30),
  ('cat_techniek', 'ICT expert / Informatie management',        40),
  ('cat_techniek', 'Internationaal Projectleider Milieutechniek', 50),
  ('cat_techniek', 'Klimaat- en energietransitieadviseur',      60),
  ('cat_techniek', 'Piloot / Gezagvoerder',                     70),
  ('cat_techniek', 'R&D manager',                               80);
