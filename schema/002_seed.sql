-- Initiële site-content. Pages-teksten zijn overgenomen uit
-- beroepenavondnijmegen.nl (mei 2026, stand "Binnenkort alle informatie").
-- Admin kan ze later vrij bewerken.

-- ============================================================
-- Settings (komen overal via {{key}}-placeholders terug)
-- ============================================================

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('event_year', '2026'),
  ('event_date_long', 'Donderdag 20 november 2026'),
  ('event_date_short', '20 november 2026'),
  ('event_time', '18:30 – 21:30'),
  ('venue_name', 'Canisius College Nijmegen'),
  ('venue_address', 'Berg en Dalseweg 207, 6522 BR Nijmegen'),
  ('organization', 'Rotary Club Nijmegen-Stad en Land'),
  ('partners', 'In samenwerking met de decanen van de middelbare scholen in Nijmegen e.o.'),
  ('contact_email', 'info@beroepenavondnijmegen.nl'),
  ('credits', 'Vormgeving huisstijl en website: Weijsters &amp; Kooij vormgevers, Grave');

-- ============================================================
-- Categorieën (uit de huidige website)
-- ============================================================

INSERT OR IGNORE INTO categories (id, name, color, sort_order) VALUES
  ('cat_creatief',    'Creatieve beroepen',                          '#e85d75', 10),
  ('cat_zorg',        'Gezondheidszorg en welzijn',                  '#3a8dde', 20),
  ('cat_handel',      'Handel, economie & zakelijke dienstverlening', '#f0a500', 30),
  ('cat_maats',       'Maatschappelijke dienstverlening / uniformberoepen', '#5a8a2e', 40),
  ('cat_onderwijs',   'Onderwijs & communicatie',                    '#9456d3', 50),
  ('cat_techniek',    'Techniek',                                    '#0fa4a4', 60);

-- ============================================================
-- Actief event (2026)
-- ============================================================

INSERT OR IGNORE INTO events (id, year, title, date, venue_name, venue_address, intro_md, is_active) VALUES
  ('ev_2026', 2026, 'Beroepenavond 2026',
   '2026-11-20',
   'Canisius College Nijmegen',
   'Berg en Dalseweg 207, 6522 BR Nijmegen',
   'Op donderdag 20 november 2026 organiseert Rotary Club Nijmegen-Stad en Land voor de 25e keer de Beroepenavond. Een avond voor leerlingen van het voortgezet onderwijs uit Nijmegen en omgeving om kennis te maken met meer dan 70 beroepen — van architect tot specialist, van politieagent tot piloot.',
   1);

-- ============================================================
-- Pages (publieke site)
-- ============================================================

INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label) VALUES
  ('/', 'Beroepenavond Nijmegen',
   'Informatieavond voor middelbare scholieren — Rotary Club Nijmegen-Stad en Land, Canisius College, donderdag 20 november 2026.',
   'DONDERDAG 20 NOVEMBER',
   'Beroepenavond 2026',
   'Wat wil jij later worden? Maak kennis met meer dan 70 beroepen op één avond — van architect tot specialist, van politieagent tot piloot.',
   '/assets/img/hero-home.jpg',
   '## Wat is de Beroepenavond?\n\nElk jaar in november organiseert Rotary Club Nijmegen-Stad en Land samen met de decanen van de middelbare scholen in Nijmegen e.o. de Beroepenavond. Voor leerlingen van het voortgezet onderwijs — en hun ouders — een avond om kennis te maken met allerlei beroepen waarvoor je een MBO-, HBO- of WO-opleiding kunt volgen.\n\nOngeveer **90 voorlichters** presenteren **circa 70 verschillende beroepen**. In 2019 — vóór corona — waren er zo''n 4.000 bezoekers. Wij verwachten in 2026 weer een vol Canisius College.\n\n## Praktisch\n\n- **Wanneer**: {{event_date_long}}, {{event_time}}\n- **Waar**: {{venue_name}}, {{venue_address}}\n- **Voor wie**: leerlingen uit het voortgezet onderwijs en hun ouders\n- **Toegang**: gratis\n\n## Programma\n\nDe avond bestaat uit meerdere **voorlichtingsrondes** van ongeveer 25 minuten. Per ronde kies je een beroep waarover je meer wilt horen. Bekijk het [tijdschema](/tijdschema) en de [uitleg per beroep](/uitleg-beroepen) om je avond voor te bereiden.',
   10, 'Home'),

  ('/introductie', 'Introductie',
   'Achtergrond en doel van de Beroepenavond Nijmegen.',
   'Over de avond',
   'Introductie',
   'De Beroepenavond is een jaarlijkse traditie, georganiseerd door Rotary Club Nijmegen-Stad en Land in samenwerking met het Canisius College en de decanen van middelbare scholen in de regio.',
   '/assets/img/hero-introductie.jpg',
   '## Het doel\n\nLeerlingen van het voortgezet onderwijs staan voor een grote keuze: welk profiel kies ik? Welke vervolgopleiding past bij mij? Welk beroep zou ik later willen uitoefenen?\n\nDe Beroepenavond helpt bij die keuze. In één avond kun je meerdere beroepen \"snuffelen\". Voorlichters die zélf in dat vak werken vertellen open en eerlijk wat het inhoudt: het werk, de opleiding, de uitdagingen en de leuke kanten.\n\n## Voor wie?\n\n- Leerlingen van **vmbo, havo en vwo** uit Nijmegen en omgeving\n- Ouders die mee willen denken over de studiekeuze\n- Brugklassers die op tijd willen oriënteren — welkom!\n\n## Hoe werkt het?\n\n- Je kiest **vooraf** welke beroepen je wilt volgen (uitleg per beroep [hier](/uitleg-beroepen)).\n- Op de avond zelf volg je twee tot drie rondes — elke ronde duurt circa 25 minuten.\n- In de [plattegrond](/rooster) zie je in welk lokaal de sessie plaatsvindt.',
   20, 'Introductie'),

  ('/tijdschema', 'Tijdschema voorlichtingsrondes',
   'Programma en tijden van de Beroepenavond.',
   'Programma',
   'Tijdschema voorlichtingsrondes',
   'De avond bestaat uit meerdere rondes van circa 25 minuten elk, met korte wisselpauzes om naar de volgende sessie te lopen.',
   '/assets/img/hero-tijdschema.jpg',
   '## Globale tijdlijn\n\n_Definitieve tijden volgen later — onderstaande is indicatief op basis van eerdere edities._\n\n| Tijd | Wat |\n|---|---|\n| **18:30** | Inloop aula |\n| **19:00** | Welkom door de organisatie |\n| **19:10** | Ronde 1 — voorlichtingssessies (25 min) |\n| **19:40** | Wisseltijd |\n| **19:50** | Ronde 2 — voorlichtingssessies (25 min) |\n| **20:20** | Wisseltijd |\n| **20:30** | Ronde 3 — voorlichtingssessies (25 min) |\n| **21:00** | Afsluitend drankje in de aula |\n| **21:30** | Einde |\n\n## Wisselen tussen sessies\n\nTussen rondes is er **10 minuten wisseltijd**. Genoeg om van het ene lokaal naar het andere te lopen, ook als de zalen op verschillende verdiepingen liggen. Bekijk de [plattegrond](/rooster) zodat je weet waar je heen moet.',
   30, 'Tijdschema'),

  ('/rooster', 'Rooster & plattegrond',
   'Plattegrond van het Canisius College met alle sessies per lokaal.',
   'Wegwijzer',
   'Rooster & plattegrond',
   'Bekijk per lokaal welke sessies er plaatsvinden, en gebruik de plattegrond om de weg te vinden in het Canisius College.',
   '/assets/img/hero-rooster.jpg',
   '_Het volledige rooster en de plattegrond volgen in oktober 2026, zodra alle sessies definitief zijn ingedeeld._\n\nIn de tussentijd kun je alvast de [uitleg per beroep](/uitleg-beroepen) bekijken om je voorkeur te bepalen.',
   40, 'Rooster'),

  ('/uitleg-beroepen', 'Uitleg per beroep',
   'Overzicht van alle beroepen die op de Beroepenavond worden gepresenteerd.',
   'Catalogus',
   'Uitleg per beroep',
   'Ongeveer 70 verschillende beroepen, verdeeld over zes categorieën — van creatieve beroepen tot techniek. Bekijk wat erbij past en kies je voorkeur voor de avond.',
   '/assets/img/hero-beroepen.jpg',
   '_Onderstaande lijst is een overzicht van de beroepen die in 2025 werden gepresenteerd. Het definitieve aanbod voor 2026 wordt later bekendgemaakt._\n\nDe beroepen zijn ingedeeld in zes categorieën. Klik op een categorie hieronder om alleen die beroepen te zien.',
   50, 'Beroepen');

-- ============================================================
-- Eerste user (placeholder — wachtwoord nog niet ingesteld)
-- ============================================================

-- Marco: na deploy zelf een echte admin aanmaken via scripts/create-first-user.sh
-- of via de admin UI nadat 'ie live is.
