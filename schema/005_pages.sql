-- ============================================================
-- Sessie 3 — nieuwe publieke pagina's + menu-volgorde + nieuws.
-- Idempotent: INSERT OR REPLACE / UPDATE. Echte newlines in TEXT.
-- ============================================================

-- Menu-volgorde van bestaande pagina's bijwerken en "Beroepen" naar voren.
UPDATE pages SET nav_order = 30, nav_label = 'Beroepen' WHERE slug = '/uitleg-beroepen';
UPDATE pages SET nav_order = 50 WHERE slug = '/rooster';

-- Voorlichters
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/voorlichters', 'Voorlichters',
   'De voorlichters die op de Beroepenavond Nijmegen hun beroep presenteren.',
   'Wie vertellen er?', 'Voorlichters',
   'Professionals uit het werkveld vertellen open en eerlijk over hun vak: de opleiding, het werk en de praktijk.',
   NULL,
   'Elk jaar staan tientallen voorlichters klaar om leerlingen te vertellen over hun beroep. Hieronder een overzicht van de voorlichters voor deze editie.',
   35, 'Voorlichters', 1);

-- Contact
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/contact', 'Contact',
   'Neem contact op met de organisatie van de Beroepenavond Nijmegen.',
   'Vragen?', 'Contact',
   'Heb je een vraag over de Beroepenavond? Stuur ons een bericht — we helpen je graag.',
   NULL, '', 70, 'Contact', 1);

-- Aanmelden als voorlichter (footer-only)
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/aanmelden', 'Word voorlichter',
   'Meld je aan om jouw beroep te presenteren op de Beroepenavond Nijmegen.',
   'Doe mee', 'Word voorlichter',
   'Deel je passie voor je vak met jongeren die voor een studiekeuze staan. Eén avond, veel impact.',
   NULL,
   '## Waarom meedoen?

Als voorlichter geef je leerlingen een eerlijk beeld van jouw beroep. Je hoeft geen ervaren spreker te zijn — je enthousiasme en eigen verhaal zijn het belangrijkst. Per ronde van circa 25 minuten vertel je een groepje leerlingen over je vak.

Vul het formulier in; we nemen contact met je op met alle praktische details voor {{event_date_long}}.',
   900, 'Word voorlichter', 1);

-- Nieuws
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/nieuws', 'Nieuws',
   'Laatste nieuws en aankondigingen over de Beroepenavond Nijmegen.',
   'Op de hoogte', 'Nieuws',
   'Het laatste nieuws over de aankomende Beroepenavond.',
   NULL, '', 60, 'Nieuws', 1);

-- Nieuwsbrief (footer-only)
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/nieuwsbrief', 'Nieuwsbrief',
   'Blijf op de hoogte van de Beroepenavond Nijmegen.',
   'Updates', 'Nieuwsbrief',
   'Laat je e-mailadres achter en ontvang updates over de avond zodra ze er zijn.',
   NULL,
   'Meld je aan voor onze nieuwsbrief en we houden je op de hoogte van de datum, het programma en het beroepenaanbod.

<form class="footer-news" method="post" action="/nieuwsbrief" style="max-width:420px">
  <input type="email" name="email" placeholder="Je e-mailadres" required style="color:#000">
  <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button type="submit">Aanmelden</button>
</form>',
   900, 'Nieuwsbrief', 1);

-- FAQ
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/faq', 'Veelgestelde vragen',
   'Antwoorden op veelgestelde vragen over de Beroepenavond Nijmegen.',
   'Hulp nodig?', 'Veelgestelde vragen',
   'De meest gestelde vragen over de Beroepenavond op een rij.',
   NULL,
   '## Voor wie is de Beroepenavond?

Voor leerlingen van vmbo, havo en vwo uit Nijmegen en omgeving, en hun ouders. Ook brugklassers zijn welkom om alvast te oriënteren.

## Wat kost het?

Niets. De toegang is gratis.

## Moet ik me aanmelden?

Nee, bezoekers hoeven zich niet aan te melden. Je kunt vrij binnenlopen. Bekijk vooraf de [beroepen](/uitleg-beroepen) en het [tijdschema](/tijdschema) om je avond te plannen.

## Hoeveel beroepen kan ik bezoeken?

De avond bestaat uit meerdere rondes van circa 25 minuten. In elke ronde kies je één beroep. Zo kun je twee tot drie beroepen van dichtbij meemaken.

## Waar is het?

{{venue_name}}, {{venue_address}}. Bekijk de [plattegrond](/rooster) om de lokalen te vinden.

## Ik wil zelf mijn beroep presenteren — kan dat?

Heel graag! Meld je aan via [Word voorlichter](/aanmelden).

## Hoe blijf ik op de hoogte?

Meld je aan voor de [nieuwsbrief](/nieuwsbrief) of volg ons via de social-links onderaan de pagina.',
   80, 'FAQ', 1);

-- Privacy (footer-only)
INSERT OR REPLACE INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published) VALUES
  ('/privacy', 'Privacyverklaring',
   'Hoe de Beroepenavond Nijmegen omgaat met je persoonsgegevens.',
   'AVG', 'Privacyverklaring',
   'We gaan zorgvuldig om met je gegevens. Hieronder lees je hoe.',
   NULL,
   'Deze website wordt beheerd door {{organization}} voor de Beroepenavond Nijmegen.

## Welke gegevens verzamelen we?

- **Contactformulier**: naam, e-mailadres en je bericht — om je vraag te beantwoorden.
- **Aanmelding als voorlichter**: naam, e-mail, telefoon, organisatie en het beroep — om de avond te organiseren.
- **Nieuwsbrief**: je e-mailadres — om je updates te sturen. Je kunt je altijd weer uitschrijven via de link in elke mail.

## Cookies

Deze website plaatst geen tracking- of advertentiecookies. Voor het beheer (alleen voor de organisatie) wordt één functionele inlog-cookie gebruikt.

## Bewaartermijn

We bewaren inzendingen niet langer dan nodig voor de organisatie van de eerstvolgende editie, daarna verwijderen we ze.

## Je rechten

Je kunt je gegevens inzien, laten corrigeren of laten verwijderen. Stuur daarvoor een e-mail naar [{{contact_email}}](mailto:{{contact_email}}).

## Verwerkers

E-mail wordt verzonden via Resend; de website draait op Cloudflare. Met deze partijen zijn de gebruikelijke verwerkersafspraken van toepassing.',
   900, 'Privacy', 1);

-- ============================================================
-- Nieuws-seed (idempotent op id)
-- ============================================================

INSERT OR REPLACE INTO announcements (id, slug, title, summary, body_md, is_published, published_at) VALUES
  ('news_datum_2026', 'datum-2026-bekend',
   'Datum bekend: donderdag 20 november 2026',
   'De 25e Beroepenavond vindt plaats op donderdag 20 november 2026 in het Canisius College.',
   'We kijken er naar uit: op **donderdag 20 november 2026** organiseren Rotary Club Nijmegen-Stad en Land en het Canisius College, samen met de decanen van de middelbare scholen in de regio, de 25e editie van de Beroepenavond.

Van 18:30 tot 21:30 maken leerlingen kennis met circa 70 beroepen. Houd deze website in de gaten voor het programma en het beroepenaanbod, of meld je aan voor de [nieuwsbrief](/nieuwsbrief).',
   1, 1781000000),
  ('news_voorlichters_gezocht', 'voorlichters-gezocht',
   'Voorlichters gezocht voor editie 2026',
   'Deel jouw beroep met jongeren die voor een studiekeuze staan. Aanmelden kan nu.',
   'Voor de editie van 2026 zijn we op zoek naar enthousiaste voorlichters uit alle vakgebieden. Of je nu architect, verpleegkundige, politieagent of softwareontwikkelaar bent: jouw verhaal helpt jongeren bij hun keuze.

Aanmelden kost weinig tijd en de avond is dankbaar werk. [Meld je aan als voorlichter](/aanmelden) — we nemen daarna contact met je op.',
   1, 1781200000);
