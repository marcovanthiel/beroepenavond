# CLAUDE.md — Beroepenavond Nijmegen

> Overdrachtsdoc. Lees dit bestand bij sessie-start zodat je op elke
> computer (MacBook én Mac mini) verder kunt zonder context te
> reconstrueren. `git fetch && git pull` eerst draaien — Marco werkt
> vanaf meerdere machines.

## Project

Website voor de **Beroepenavond Nijmegen** — jaarlijkse
voorlichtingsavond door **Rotary Club Nijmegen-Stad en Land** samen met
de **decanen van de middelbare scholen in Nijmegen e.o.**, gehost op
het **Montessori College Nijmegen** (Kwakkenbergweg 27; gecorrigeerd
11-9-2026, stond eerder onterecht als Canisius College).

- **Datum 2026**: donderdag 12 november 2026, 18:30 tot 21:30 (gecorrigeerd 11-9-2026; was foutief 20 nov)
- **Live**: `https://beroepenavond2026.nl/` (sinds 11-9-2026; oude domein
  inijmegen.com redirect 301 met padbehoud en blijft van ons)
- **Repo**: `marcovanthiel/beroepenavond` (public)
- **Bron-content**: gekopieerd van `beroepenavondnijmegen.nl` (mei 2026)

## Architectuur

Cloudflare Worker met Hono + D1 (content + sessies + sprekers).
Statische assets via ASSETS-binding gemount onder `/assets/*`.
Patroon hetzelfde als bij `inijmegen.nl`.

- **Account-ID**: `04865fcd4034789d3970c1b51950227c`
- **Zone-ID inijmegen.com**: `ae640a240c4ce0a2a5c309f349c93a37`
- **D1**: `beroepenavond` (`8bb285c2-b8be-40bb-98c3-8e58635c47d9`)
- **R2** (nog te maken; token mist R2-Edit-permissie): `beroepenavond-assets`

## Data-model

13 tabellen (zie `schema/001_init.sql` + `003_beroepen.sql`):

- **events** — jaarlijkse avond (één actief tegelijk via `is_active`)
- **rounds** — voorlichtingsrondes binnen een avond
- **categories** — beroepscategorieën (6 stuks)
- **beroepen** — individuele beroepen (65 stuks), FK naar categories
- **speakers** — voorlichters met contactgegevens, foto, biografie
- **classrooms** — lokalen, `map_shape` (JSON polygon) voor plattegrond
- **floorplans** — één of meerdere plattegronden per event
- **sessions_program** — beroepssessie (event × ronde × lokaal ×
  category × sprekers)
- **session_speakers** — M-op-M tussen sessies en sprekers
- **users / sessions / audit_log / settings / pages** — CMS-tabel

## Status (19 juni 2026)

### ✅ Klaar
- Project-skelet, schema, seed-content (5 pages + 6 categorieën + 65
  beroepen + actief event 2026)
- Custom domain `inijmegen.com` gekoppeld via Account API
- Auto-deploy via GitHub Actions naar Cloudflare Worker
- **Homepage 1-op-1 nagebootst** van bron, inclusief:
  - mannetje-silhouet als body-background (`right top`, `contain`)
  - DM Sans typografie
  - lime accent **#88BC1D** + banner `rgba(136,188,29,0.25)`
  - "2026" tot 185px rechts-uitgelijnd
  - groene email-button
  - Schrofenblick-sponsor (was in bronsite)
  - block-volgorde exact uit bron-HTML (8a/8b/9a/9b/4/92/56/95a/95b/95c)
  - full-width banner + zwarte balk; content binnen 1056px container
  - alle 6 accordion-categorieën starten dicht; klik → uitvouwen
- Subpagina's (introductie / tijdschema / rooster / uitleg-beroepen)
  met algemene layout, DM Sans + lime accent
- Favicon (origineel BN-logo van de bronsite, zwart op wit)
- Copyright: **© Rotary Club Nijmegen-Stad en Land** (Weijsters & Kooij-
  credit verwijderd op verzoek Marco)

### ✅ Klaar (19 juni 2026, sessie 2 — admin + plattegrond)
- **R2-bucket `beroepenavond-assets`** aangemaakt (lokale wrangler-OAuth
  hééft wél R2-rechten; de eerdere "token mist R2-Edit" gold voor de
  CI-token). Binding `ASSETS_R2` actief in `wrangler.toml`.
- **`SESSION_SECRET`** gezet: prod via `wrangler secret put`, lokaal in
  `.dev.vars` (gitignored). Nodig voor HMAC-signed cookies.
- **Login + sessies** — `src/lib/auth.ts`: PBKDF2-SHA256 (WebCrypto),
  sessie in D1, HMAC-signed cookie `ba_session`, `requireAuth`.
- **Eerste admin** zonder script: bij 0 users toont `/admin/login`
  automatisch een setup-formulier (maak eerste beheerder → meteen
  ingelogd). Dus géén `create-first-user.sh` meer nodig.
- **Volledige admin-UI `/admin/*`** — dashboard + CRUD voor pages,
  settings, events (met activeren), rounds, categories, beroepen,
  speakers (R2-fotoupload), classrooms, floorplans (R2-upload),
  sessions_program (M2M sprekers). Audit-log bij elke mutatie.
- **Media** — upload naar R2 + publieke serve-route `GET /media/*`
  (`src/lib/media.ts`).
- **Plattegrond-editor** `/admin/floorplan-editor` — teken polygons per
  lokaal op de achtergrond-afbeelding (klik = punt, sleep = bijstellen,
  autosave). Client: `public/assets/js/floorplan-editor.js`.
- **Interactieve publieke plattegrond** op `/rooster` — SVG met
  klikbare lokaal-polygons (kleur per categorie) → modal met
  sessie/ronde/spreker. View: `src/views/rooster.ts`, client:
  `public/assets/js/floorplan-view.js`.
- Lokaal getest: auth-flow, alle CRUD-lijsten (200), R2-upload→`/media`
  (200, image/png), end-to-end keten lokaal→sessie→`/rooster`-map.
- Remote D1 bevat al alle tabellen uit `001_init` — geen migratie nodig.

### ⚠️ Belangrijk: CI-deploy vs. R2-token
Sinds de R2-binding (`ASSETS_R2`) in `wrangler.toml` staat, valideert
`wrangler deploy` de bucket bij elke deploy. De **GitHub Actions-token
(`CLOUDFLARE_API_TOKEN`) mist R2-rechten** → de auto-deploy faalt met
`Authentication error [code: 10000]` op `/r2/buckets/beroepenavond-assets`.

→ **Fix (1×, dashboard):** Cloudflare → My Profile → API Tokens → de token
achter de GH-secret bewerken → permissie **Account · Workers R2 Storage ·
Edit** toevoegen → opslaan. Daarna `gh run rerun <id>` of een nieuwe push;
CI wordt groen. De lokale wrangler-OAuth hééft R2 wél, dus tot die fix
deploy je met:
`export PATH="/opt/homebrew/opt/node@22/bin:$PATH" && npx wrangler deploy`.

### ⏳ Te doen
- **CI-token R2-permissie** toevoegen (zie hierboven) — daarna werkt de
  push→auto-deploy weer.
- Optioneel: extra editors/admins aanmaken (nu alleen de eerste admin
  via de setup-pagina op `/admin/login`).

### ✅ Domein
`inijmegen.com` (apex) én `www.inijmegen.com` werken; `www` 301-redirect
naar apex via de Worker-middleware. Geen verdere DNS-actie nodig.

### ℹ️ Lokaal draaien — Node 22 vereist
`wrangler` weigert op Node 20. Gebruik:
`export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` vóór `wrangler …`.

## Sessie 3 — volledige publieke site + backend + admin (LIVE)

### Publieke site (alles in huisstijl DM Sans + lime, responsive, a11y)
- **Design-system** uitgebreid in `style.css` (cards, grids, forms,
  catalogus, sprekers, nieuws, notices, social-footer). `layout.ts`:
  skip-link, breadcrumbs, hero-CTA's, JSON-LD, OG/canonical,
  nieuwsbrief-mini-form + social in footer. Homepage kreeg de gedeelde
  nav (signature-body blijft).
- **Nieuwe pagina's**: `/uitleg-beroepen` = volledige **beroepencatalogus**
  (zoek + categoriefilter, client-side), `/voorlichters` (sprekers-grid),
  `/nieuws` + `/nieuws/:slug`, `/faq`, `/privacy` (AVG), `/contact`,
  `/aanmelden` (voorlichter), `/nieuwsbrief`. Dynamische content via
  `src/views/sections.ts`; gerouteerd in `routes/public.ts`.
- **SEO**: dynamische `/sitemap.xml` (uit pages + nieuws + beroepen), JSON-LD
  Event op home, OG/canonical overal. `robots.txt` verwijst naar de canonieke
  `https://beroepenavond2026.nl/sitemap.xml` (was foutief inijmegen.com, dat
  301't) en disallowt `/admin/` + `/leerling/`. IndexNow (Bing/Yandex): sleutel
  `8185f0f562b8b9fe678eb129048b65c3`, sleutelbestand op
  `/8185f0f562b8b9fe678eb129048b65c3.txt` (route in `index.ts`, bestand in
  `public/`); submit met host+keyLocation op beroepenavond2026.nl, NIET
  inijmegen.com (dat is een 301-redirectdomein).

### Backend / formulieren
- 3 formulieren met honeypot-spam-bescherming → opslaan in `submissions`
  (contact/volunteer) en `subscribers` (nieuwsbrief, light double-opt-in
  met confirm/uitschrijf-token). Tabellen in `schema/004_extra.sql`.
- **E-mail via Resend** (`src/lib/email.ts`): notificatie naar org +
  bevestiging naar inzender + nieuwsbrief-confirm. Config-gestuurd
  (settings `mail_*` + secret `RESEND_API_KEY`, al gezet). **Graceful**:
  zonder geverifieerd domein worden inzendingen wél opgeslagen, maar gaat
  er geen mail uit.

### Admin (uitgebreid)
- Nieuw: **Inbox** (contact/voorlichter afhandelen + "→ maak spreker"),
  **Nieuwsbrief** (lijst + CSV-export), **Nieuws**-CRUD (cover-upload),
  **Gebruikers** (rollen, alleen admin), **Mijn account** (naam +
  wachtwoord), **Media-bibliotheek** (R2 lijst/upload/verwijderen),
  **Audit-log**. Dashboard toont openstaande berichten + laatste
  inzendingen.

### ⏳ Openstaand voor Marco (2 dashboard-acties)
1. **E-mail aanzetten**: DNS-records voor `inijmegen.com` toevoegen in
   Cloudflare (zie `docs/EMAIL_DNS.md`). Daarna verstuurt Resend mail
   vanaf `noreply@inijmegen.com`. (Domein staat al in het Resend-account,
   status `not_started` tot de records er zijn.)
2. **CI-token R2-permissie** (zie hierboven) zodat push→auto-deploy weer
   groen wordt. Tot dan: handmatig `npx wrangler deploy` (met Node 22).

Schema-migraties: `001`→`005`. Lokaal/remote toepassen met
`npm run db:apply:remote` of per bestand
`npx wrangler d1 execute beroepenavond --remote --file=schema/00X_*.sql`.

## Sessie 4 — leerling-accounts (LIVE, 21 juni 2026)

Eigen, van het beheer losstaand **leerling-portaal** op `/leerling`.
Leerlingen loggen passwordless in (magic link per e-mail) en stellen hun
eigen avond samen. Bewust dataminimalisatie (minderjarigen): alleen
naam, e-mail, school, profiel.

### Schema `019_students.sql` (lokaal + remote toegepast)
`students` (id, email UNIQUE, name, school, profiel, newsletter,
created_at, last_login) · `student_tokens` (magic-link, 30 min) ·
`student_logins` (sessies, 30 dagen) · `student_picks` (gekozen
beroepen, M2M) · `student_interests` (interessecategorieën, M2M) ·
`student_questions` (vragen vooraf, status new/handled).

### Auth — `src/lib/studentauth.ts`
- **Apart van admin**: eigen cookie **`ba_student`** (HMAC-signed via
  `SESSION_SECRET`), eigen tabellen. Leerlingen komen nooit in `/admin`.
- `requestLogin()` upsert leerling + maakt token + mailt magic link
  (Resend, via `mailConfig`/`sendEmail`/`emailShell`).
- `verifyToken()` valideert (unused + niet verlopen), markeert `used`,
  maakt login-sessie, zet cookie. **Gotcha:** geeft de leerling direct
  op `student_id` terug — `getCurrentStudent()` zou hier null geven want
  de zojuist gezette cookie zit nog niet in het binnenkomende request.
- `requireStudent` middleware → redirect naar `/leerling` als niet
  ingelogd.

### Portaal — `src/routes/student.ts` (gemount op `/leerling`)
`GET /` login-form óf dashboard · `POST /login` (honeypot) · `GET
/verify` · `POST /logout` · `GET /kiezen` + `POST /kies` (beroepen
per categorie toggelen) · `GET|POST /profiel` (naam/school/profiel +
interessecategorieën) · `POST /vraag` (vraag vooraf) · `POST
/nieuwsbrief` (toggle + upsert in `subscribers`) · `GET /rooster.ics`
(agenda-export). Dashboard toont keuzes, aanbevelingen (beroepen in
interessecategorieën die nog niet gekozen zijn), vragen, nieuwsbrief.

### Koppelingen
- `/voorlichters?beroep=N` toont een **leerling-box**: "Voeg toe aan
  mijn avond" (→ `POST /leerling/kies`) + "Vraag vooraf" (→ `POST
  /leerling/vraag`). In `src/views/sections.ts` (`renderVoorlichters`).
- Nav-item **"Mijn avond"** → `/leerling` (layout.ts + home.ts).
- Admin: **`/admin/leerlingen`** (accounts + #keuzes) en tab **Vragen
  vooraf** (afhandelen/verwijderen). In Communicatie-groep.

### Cache
`/leerling` staat (net als `/admin`) op `no-store` in `src/index.ts`.

### ⚠️ Afhankelijkheid: Resend-domeinverificatie
Magic-link e-mails worden **pas bezorgd zodra het Resend-domein
`inijmegen.com` geverifieerd is**. De 3 DNS-records (DKIM
`resend._domainkey`, MX `send`, TXT `send` SPF) staan live in Cloudflare
en resolven publiek; Resend stond bij oplevering nog op PENDING
(hercheck-vertraging aan hun kant). Tot verificatie wordt de login-link
wél aangemaakt maar niet gemaild. Controleer status in het Resend-
dashboard; daarna werkt de magic-link-flow volledig.

## Sessie 5 — passwordless admin-login + spamfilter (LIVE, 24 juni 2026)

### Admin-login via e-mailcode (vervangt wachtwoord)
- `/admin/login` vraagt nu alléén een **e-mailadres** → er wordt een **6-cijferige
  code** gemaild (Resend) → `/admin/code` controleert de code → sessie. Wachtwoord-
  login is eruit. **Alleen e-mailadressen met een `users`-account (door admin
  aangemaakt) kunnen inloggen** — anti-enumeratie: de code-stap toont altijd dezelfde
  tekst, ook bij een onbekend adres.
- Codes: gehasht (`sha256(code:email)`), 10 min geldig, max 5 pogingen, één actieve per
  e-mail. Schema **`020_admin_login_codes.sql`** (lokaal + remote toegepast). Helpers in
  `src/lib/auth.ts`: `genCode` / `setLoginCode` / `verifyLoginCode`. Sessies/cookie
  (`ba_session`) ongewijzigd.
- **Admins aangemaakt** (rol `admin`): `marco@marcovanthiel.nl`, `jcmhendriksra@gmail.com`
  (Hans Hendriks), `marijke.van.veen@wxs.nl` (Marijke van Veen). Nieuwe accounts maak je
  via `/admin/users` — **wachtwoord is daar nu optioneel** (login gaat via code; bij leeg
  een willekeurig ongebruikt wachtwoord). De `/admin/setup`-eerste-admin-flow blijft als
  fallback bij 0 users (maar wordt niet meer getoond zolang er admins zijn).
- **Afhankelijkheid:** codes worden alleen bezorgd zolang Resend-domein `inijmegen.com`
  geverifieerd is (zelfde voorwaarde als de leerling-magic-link).

### Spamfilter op publieke formulieren
- `src/lib/spam.ts`: scorend filter bovenop de honeypot, gebruikt in `/contact`,
  `/aanmelden`, `/nieuwsbrief` (via `isBot()` in `routes/public.ts`). Sterke signalen
  (100): honeypot gevuld · URL/BBCode/verdachte TLD · niet-Latijns schrift. Zwakke
  signalen (2, ≥2 nodig): naam-CamelCase-zonder-spatie (bv. "RobertTic") · willekeurig
  e-mail-lokaaldeel (bv. "zekisuquc419"). Drempel = 3. Bij spam doet de route alsof het
  gelukt is (**geen opslag/mail**), zodat bots niets leren. Drempel/regels aanpasbaar in
  `spam.ts`.
### Cloudflare Turnstile (bedraad, gracieus aan/uit)
Turnstile is **al ingebouwd** op `/contact` en `/aanmelden`, maar **gracieus**: het werkt
alleen als beide sleutels gezet zijn, anders draait alleen het heuristiek-filter.
- **Site key** (publiek): setting `turnstile_site_key` in de `settings`-tabel → de forms
  tonen dan de Turnstile-widget (`src/views/sections.ts`).
- **Secret** (geheim): Worker-secret `TURNSTILE_SECRET_KEY` → `routes/public.ts`
  verifieert de token via siteverify (`verifyTurnstile()` in `lib/spam.ts`); faalt de
  check → formulier opnieuw met "bevestig dat je geen robot bent" (fail-open bij
  netwerkfout zodat een storing echte bezoekers niet blokkeert).
- **CSP** staat `https://challenges.cloudflare.com` al toe (script/connect/frame-src).
- **Aanzetten (na widget aanmaken in dashboard → Turnstile → Add, domein inijmegen.com,
  mode Managed):**
  ```bash
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
  npx wrangler d1 execute beroepenavond --remote --command \
    "INSERT INTO settings (key,value) VALUES ('turnstile_site_key','0x...SITEKEY') \
     ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  npx wrangler secret put TURNSTILE_SECRET_KEY   # plak de secret
  ```
  (Geen redeploy nodig: setting = D1, secret-put herdeployt zelf.) Uitzetten = de setting
  legen.

## Sessie 6 — admin gebruiksvriendelijker (LIVE, 25 juni 2026)

Beheer-paneel toegankelijker gemaakt voor niet-technische gebruikers
(Rotary-leden, decanen). Alles blijft server-side; `admin.js` is enkel
progressive enhancement (werkt zonder JS).

- **Mobiel/tablet**: `.admin`-grid wordt 1-koloms onder 860px met een
  sticky **hamburger-topbar**; de zijbalk is een inschuifbare drawer
  (CSS-only checkbox-hack `#nav-toggle` + `.nav-overlay`, géén JS). Brede
  tabellen scrollen horizontaal. Zie blok onderaan `admin.css`.
- **Nav-iconen** per menu-item (emoji in `NAV` in
  `src/views/admin/layout.ts`) + `.nav-ico`.
- **Direct-zoekfilter** boven de lange lijsten (sprekers, beroepen,
  leerlingen, vragen, postvak, nieuwsbrief): client-side filteren zonder
  herladen + teller "X van Y". Helpers `filterBar()` / `filterEmptyRow()`
  in `layout.ts`, logica in `public/assets/js/admin.js` (input met
  `data-filter-target="#tabel-id"`). De tabel krijgt dat id; een
  `[data-filter-empty]`-rij verschijnt bij geen treffers.
- **Dashboard** (`routes/admin/index.ts`): snelacties in de page-head +
  **"Klaar voor de avond?"-checklist** met voortgangsbalk (actieve
  editie, rondes, voorlichters bevestigd, sessies, plattegrond,
  e-mail aan, publicatie aan) + klikbare stat-tegels (hover/pijl).
- **Formulieren/acties**: `admin.js` zet een **spinner** op de
  verzendknop en voorkomt **dubbel verzenden** (`form.dataset.submitting`
  + 8s vangnet; respecteert `confirm()` via `e.defaultPrevented`, sla
  over met `data-no-busy`). Verplicht-velden tonen een gekleurde `*`
  (`field()` + `.req`). Vriendelijke lege-staten met actieknop
  (`emptyState()`), **terug-links** op detailpagina's (`backLink()`),
  en een extra bevestiging bij *publicatie uitzetten*.
- **Nieuwe layout-helpers**: `filterBar`, `filterEmptyRow`, `emptyState`,
  `backLink` (geëxporteerd uit `views/admin/layout.ts`). Nieuw asset
  `public/assets/js/admin.js` (via `<script defer>` in de admin-shell;
  CSP staat `script-src 'self'` toe).
- **Let op (assets)**: een **nieuw** asset-bestand kan na een succesvolle
  deploy ~1 min propagatie-vertraging hebben (404 → 200). Een 404 op een
  gloednieuw pad is dus niet per se een cache-/deploy-fout; even pollen.

### Vervolg (25 juni): bulk-acties + zoeken in keuzelijst
- **Bulk-bevestigen** op `/admin/speakers`: selectievakje per rij +
  "alles selecteren" (alléén zichtbare rijen na de zoekfilter) + een
  **bulk-balk** (`#bulk-speakers`-form) om geselecteerde voorlichters
  tegelijk te **bevestigen / intrekken**. Checkboxes hangen via het
  `form="bulk-speakers"`-attribuut aan de balk (géén geneste forms in de
  tabel). Optioneel ook een bevestigingsmail per voorlichter (vinkje,
  **standaard uit** om massa-mail te voorkomen). Route **POST
  `/admin/speakers/bulk`** — **vóór `/:id` registreren** anders vangt
  `/:id` "bulk" op. Body via `parseBody({ all: true })` (niet
  `c.req.formData()` — dat gaf lege `ids` in workerd).
- **Zoeken in de spreker-keuzevakjes** op het sessie-formulier
  (`#ses-speakers` + `data-filter-list` in admin.js) — handig bij 169
  voorlichters.
- **Alle 169 voorlichters op `confirmed = 0` gezet** (op verzoek), zodat
  ze via de nieuwe bulk-knop opnieuw bevestigd kunnen worden. Publicatie
  staat (nog) uit.
- **Doorzoekbaar beroep-keuzeveld**: de beroep-`<select>` (spreker- én
  sessie-formulier) heeft `data-combo` en wordt door `enhanceCombo()` in
  admin.js een typ-om-te-zoeken combobox. De native `<select>` blijft
  (verborgen, `.combo__native`) de bron → zonder JS gewoon een dropdown.
- **Overzicht "beroepen zonder spreker"** (gerichte werving): tab
  *Zonder spreker (N)* op `/admin/beroepen?filter=zonder` (telt beroepen
  waar géén `speakers.beroep_id` naar verwijst — los van bevestiging).
  Per rij een **"+ Voorlichter"**-knop →
  `/admin/speakers/new?beroep=ID` met dat beroep voorgeselecteerd
  (`speakers` GET `/new` leest `?beroep`). Ook een dashboard-tegel
  "Beroepen zonder spreker". Stand bij oplevering: **20 van 120**.
- **Werflijst-export (PDF + CSV)**: knop op de "Zonder spreker"-tab →
  **GET `/admin/beroepen/zonder-spreker.pdf`** (en `.csv` blijft bestaan).
  Beide routes **vóór `/:id`** registreren, anders vangt `/:id` het
  bestandspad op. CSV = UTF-8 BOM (Excel-proof). **PDF** via **`pdf-lib`**
  (pure JS, werkt in de Worker): `src/lib/pdf.ts` `buildWerflijstPdf()`
  tekent het **Rotary-logo** bovenaan (`public/assets/img/rotary-logo.png`,
  overgenomen uit de zustersite; opgehaald via de **ASSETS-binding** in de
  route), titel, datum en de beroepen per categorie met aanvink-vakjes
  (auto pagina-afbreking + paginanummers). Aandachtspunten: pdf-lib's
  standaardfonts zijn **WinAnsi** → niet-codeerbare tekens vervangen
  (`winansi()` helper); datum **handmatig** in NL opgemaakt (geen
  Intl-afhankelijkheid in de Worker). Bundel met pdf-lib ≈ **290 KiB
  gzip**, ruim onder de limiet. **Huisstijl**: document-accenten (titel +
  scheidingslijn) in de Beroepenavond-lime **#88BC1D**; het logo is de
  **clubversie** = Rotary-merk met "Nijmegen-Stad en Land" eronder in
  logo-blauw **#17458f** (lockup conform de zustersite). Per categorie de
  eigen **categoriekleur** (`categories.color` via `hexToRgb()`): gevuld
  swatch-vierkantje bij de kop + aanvinkvakjes in die kleur — net als de
  gekleurde opsommingstekens op de site.

## Sessie 7 — toegankelijkheidsverklaring (LIVE, 10 september 2026)

- **`/toegankelijkheid`**: toegankelijkheidsverklaring als footer-only
  pagina in D1 (`schema/021_toegankelijkheid.sql`, nav_order 901,
  lokaal + remote toegepast). Inhoud: streven naar WCAG 2.2 AA in lijn
  met de European Accessibility Act en EN 301 549; naar beste weten
  geheel of grotendeels conform, geen afwijkingen bekend; melden via
  marco@marcovanthiel.nl; opgesteld 10 september 2026. U-vorm.
- Footerlink **"Toegankelijkheidsverklaring"** in de gedeelde footer
  (`src/views/layout.ts`, dus ook leerling-portaal) én in het
  copyright-blok b-95c van de homepage (`src/views/home.ts`, daar samen
  met een Privacy-link).

## Rollen in het beheer (relatiebeheerder toegevoegd 11-9-2026)
`users.role` kent drie waarden: **admin** (Beheerder, alles incl. gebruikers),
**editor** (Redacteur, inhoud + programma) en **relatiebeheerder**
(Relatiebeheerder). Aanmaken via beheer → Gebruikers (alleen admins), inloggen
via de e-mailcode-flow (wachtwoord optioneel). Labels via `roleLabel()`.
- **Relatiebeheerder** = mag het HELE beheer inzien (alle GET), en de
  volledige voorlichter-werkstroom bewerken: **postvak** (aanmeldingen
  afhandelen/omzetten naar voorlichter), **uitnodigingen** (nieuw + vorig
  jaar + auto-herinnering) en **voorlichters** (CRUD, bevestigen, bulk),
  plus het eigen account. Afgedwongen met een middleware in
  `routes/admin/index.ts` ná `requireAuth`: voor deze rol worden alle niet-GET-
  verzoeken buiten de allowlist `RELATIEBEHEERDER_BEWERKT`
  (`/admin/speakers`, `/admin/uitnodigingen`, `/admin/inbox`, `/admin/account`
  + `/admin/logout`) geweigerd met **403** en een in-app-melding. Padmatching
  is exact (`p` of `p + '/'`), niet losse `startsWith`. `/admin/users` blijft
  admin-only.
- Naamkeuze bewust: bij nijmegenduckstad heet de vergelijkbare rol
  "accountmanager" (beheert eigen prijzen); hier "relatiebeheerder" op verzoek.
- Nieuwe mutatie-route toevoegen die relatiebeheerders óók mogen? Zet het pad
  in de `toegestaan`-lijst van die middleware.

## Belangrijke gotchas (bij eerdere bugs gevonden)

1. **`c.env.ASSETS.fetch(c.req.raw)` faalt soms** in productie. Werkt
   wel met `new Request(c.req.url)`. Zie `src/index.ts` `serveAsset`.
2. **Security-header middleware** moet de respons wrappen in een
   nieuwe `Response` — `ASSETS.fetch()` returnt immutable headers
   (`TypeError: Can't modify immutable headers`).
3. **SQLite interpreteert geen `\n`-escapes** binnen single-quoted
   TEXT. Multi-line strings: zet ECHTE newlines tussen quotes in het
   .sql-bestand. Anders zie je letterlijk `\n\n` in je content.
4. **DB-cleanup tussen sessies**: gebruik `INSERT OR REPLACE` (niet
   `OR IGNORE`) als je seed-content wilt kunnen herstellen.

## Bron-stijl tokens (uit beroepenavondnijmegen.nl CSS)

| Token | Waarde | Toelichting |
|---|---|---|
| Font | DM Sans 400 / 500 / 700 | Google Fonts |
| Accent groen | `#88BC1D` | "BEROEPENAVOND", arrows, button |
| Banner-vlak | `rgba(136,188,29,0.25)` | "Binnenkort alle informatie" |
| Tekst zwart | `#000000` | Body en headings |
| Achtergrond | `#FFFFFF` | Wit |
| Container | `1056px` | Maximale content-breedte |
| Mannetje | `/assets/img/mannetje.jpg` | body-background right top contain |
| 2026 font-size | clamp(60px, 14vw, 185px) | letter-spacing 2px |
| Accordion handle | 20px DM Sans 500 uppercase | bg #000, color #fff |
| Email button | `#88BC1D` | padding 7px 14px, font-size 20px |
| Zwarte balk | 50px hoog | `block-4` placeholder voor sticky nav |

## Deploy

```
push naar main → .github/workflows/deploy.yml
              → cloudflare/wrangler-action@v3
              → wrangler deploy
              → Worker live in ~25s
```

GH secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Lokaal werken

```bash
git fetch && git pull               # bij sessie-start ALTIJD
npm install
npm run db:apply:local              # schema lokaal aanmaken
npm run dev                          # wrangler dev op :8787
```

DB-wijziging uitrollen:
```bash
npx wrangler d1 execute beroepenavond --remote --file=schema/00X_xxx.sql
```

Remote D1 vanaf de terminal (wrangler is non-interactief en eist een
token in de omgeving): Mac mini → `export CLOUDFLARE_API_TOKEN=$(cat
~/.cf-token)`; MacBook → `source ~/Developer/dandanshop/.mailconfig.env`
(die token heeft D1-rechten op het account). Altijd met Node 22 in PATH.

## Bron-CSS gearchiveerd

Bij volgende sessie tot de bron nodig is: download opnieuw met
```bash
curl -sS https://www.beroepenavondnijmegen.nl/assets/css/website.css -o /tmp/website.css
curl -sS https://www.beroepenavondnijmegen.nl/assets/css/page-1369748.css -o /tmp/page.css
```
of bekijk via webview de homepage-HTML (`view-source:`).

## Bestandsstructuur

```
src/
  index.ts                 # Hono entry + ASSETS-route + security headers
  env.ts                   # Bindings/Env types
  lib/
    db.ts                  # D1-helpers: getSettings, getPage, getCategoriesWithBeroepen, interpolate
    markdown.ts            # tiny markdown→HTML
  routes/
    public.ts              # catch-all slug → home of page
  views/
    home.ts                # Homepage (mannetje + accordion + sponsor)
    layout.ts              # Algemene layout voor subpages
    public.ts              # renderPage + renderError
schema/
  001_init.sql             # 13 tabellen
  002_seed.sql             # settings, categories, event, pages
  003_beroepen.sql         # beroepen-tabel + 65 beroepen
public/
  assets/
    css/style.css          # Volledige publieke stylesheet (bron-tokens)
    img/
      mannetje.jpg         # Hét silhouet — body-background homepage
      schrofenblick.png    # Sponsor-logo (block-95b)
      favicon.png          # Origineel BN-logo uit bronsite
.github/workflows/
  deploy.yml               # cloudflare/wrangler-action@v3
wrangler.toml              # Worker + D1 + assets-binding
```

## Categorie-uitschuifmenu op de home (drawer, LIVE 11-9-2026)

Klik op een categorietegel in de home-strip → het gekozen kleurvlak GROEIT
op zijn eigen plek open tot een paneel ("container transform"): start =
exact de tegel-rechthoek, eind = een comfortabel paneel dat vanaf de tegel
opengroeit (horizontaal verankerd, schuift omhoog als het onder de tegel niet
past). Blijft op de home, navigeert niet. Opbouw in `src/views/home.ts` +
CSS `.cat-drawer*` in style.css (cachebuster staat nu op ?v=5):
- Elke tegel blijft een echte link `/beroepen?cat=<id>` (werkt zónder JS);
  het inline script onderschept de klik en opent het paneel.
- Paneelinhoud per categorie staat als verborgen `<template data-cat>` in
  de HTML (server-side, geen fetch). Script kopieert de juiste template in
  `#catBody`.
- Wisselen: het oude paneel schuift dicht, dan het nieuwe open (Marco's
  volgorde; timing = CSS-duur 340ms). Wisselen kan via de verlichte
  strip-tegels (blijven boven de scrim, z-index 95) én via de kleurstippen
  ONDERIN het paneel (altijd bereikbaar, ook voor tegels onder het paneel).
- Paneelopbouw: gekleurde kop bovenaan (= het groeiende blok; tekstkleur via
  tekstOp, dus donker op geel), leesbare witte beroepenlijst, kleurstippen +
  "Bekijk dit hele vakgebied →" onderin. Vaste-maat binnenlaag (#catInner,
  JS zet de eindmaat) zodat de inhoud niet verspringt terwijl het paneel
  groeit; het paneel klipt de inhoud. Mobiel <480px = bijna schermvullend.
- VALKUIL (opgelost 11-9-2026): de sluit-✕ in de kop is `position:absolute`
  maar de eyebrow-tekst is een blok over de VOLLE breedte en lag eroverheen,
  waardoor die de klik afving en het kruisje nergens sloot. Fix: sluitknop
  `z-index` + ruimere klikzone, en decoratieve labels (eyebrow/count)
  `pointer-events:none`. Verifieer interactieve UI met Playwright (klik echt
  op de knoppen), niet alleen met screenshots — een headless `--screenshot`
  toont zo'n overlap niet.
- Techniek: JS zet left/top/width/height op het paneel en animeert die
  (transition op die vier eigenschappen, .notrans-klasse om de startpositie
  zonder animatie te zetten). DUR (360ms) = de CSS-duur.
- A11y: Esc sluit, focus naar de paneelkop, `prefers-reduced-motion`
  (geen slide, directe wissel), aria-expanded/aria-current.
- Deep-link: `/#vak=<categorie-id>` opent dat paneel direct (deelbaar).
- Verifiëren: het script opent via rAF, dus headless `--screenshot` toont de
  dichte staat; visueel checken doe je door de open-staat te injecteren
  (body.cat-open + drawer.open + #catBody vullen + scrim.show) op de echte
  HTML/CSS, of via de deep-link met echte browser.

## Herontwerp 2026 "Kleurblok" (LIVE, 10 september 2026)

Het gekopieerde bron-ontwerp mocht niet langer gebruikt worden; de site heeft
een eigen ontwerp gekregen. Ontwerptraject: mockup-rondes in een Artifact
(8 richtingen → keuze "Kleurblok" → 9 kritiekrondes), daarna ingebouwd.

### Designsysteem
- **Typografie**: Archivo (variabel) + Archivo Black, **self-hosted** in
  `public/assets/fonts/` (latin-subsets, samen ~45 KB). Google Fonts is uit
  de CSP verwijderd. Display-klasse via CSS-var `--zb`.
- **Kleuren**: zwart/wit-basis (`--c-ink #0d0d0d`); de zes categoriekleuren
  zijn geharmoniseerd in D1 (022): roze #E14B64, blauw #2E7ED4, geel #F0A400,
  groen #55862A, paars #8A4FD0, teal #0A9B9B. Tekstkleur op een vlak bepaalt
  `tekstOp()` in `src/views/figuur.ts` (geel krijgt donkere tekst).
- **Jaarfiguur**: Aicher-stijl pictogram in `src/views/figuur.ts`; elk jaar
  één beroep (settings `jaarfiguur_beroep` + `jaarfiguur_kleur`), altijd in
  drie gedaanten (man/vrouw/X via haarvorm) die **per dag** wisselen
  (deterministisch, cache-veilig). Nieuw jaar = nieuwe beroepslaag tekenen
  in figuur.ts + settings bijwerken.
- **E-mail**: alle uitgaande mail loopt door `emailShell()` + `emailButton()`
  in `src/lib/email.ts` (zwarte kopbalk, zes-kleurenstrip, zwarte knoppen;
  e-mailveilig: tabellen, inline CSS, systeemfonts). Elke mail eindigt met
  een merkblok: slogan (setting `mail_slogan`, default "169 professionals.
  Eén missie." — bijwerken bij een nieuwe editie of via admin-settings),
  datum/locatie uit settings en het jaarfiguur als PNG
  (`/assets/img/mail-figuur-{man,vrouw,x}.png`, wisselt per dag; nieuwe
  jaarfiguur = nieuwe PNG's genereren). Nieuwe mailsoorten altijd via
  deze helpers bouwen.
- **Iconen**: favicon = 6-kleurenraster, og.png = 20.11-poster (beide
  gegenereerd, bron-HTML in de sessie-scratchpad; opnieuw maken = klein
  HTML'tje + headless-chrome-screenshot op maat).

### Pagina's
- **Home** (`src/views/home.ts`): monument "dd.mm" (uit de actieve editie),
  jaarfiguur-veld, categoriestrip (links naar /beroepen?cat=…), dynamische
  feitenregel, "Hoe werkt het?" (4 stappen), sprekersbalk. Teller-logica:
  bevestigde voorlichters zodra gepubliceerd én er ≥1 bevestigd is, anders
  aangemelde (vangnet tegen "0 professionals").
- **/beroepen** (`src/views/beroepen.ts`): treklijsten per categorie
  (native `details/summary`, werkt zonder JS); `?cat=<id>` klapt
  server-side open. Rij-aantallen (N voorlichters) alleen bij publicatie.
- **/beroepen/:id**: detail met categorie-mini-strip + beroep-blokjes
  (max 12 + "alle N"), voorlichters, rondes/lokaal uit het programma,
  leerling-acties met **tooltip** ("+ Zet in mijn avond",
  aria-describedby; op touch een vaste uitlegregel). `/uitleg-beroepen`
  → 301 naar /beroepen; pages-rij is in 022 omgezet.
- **Layout** (`renderLayout`): optie `bare: true` rendert bodyHtml zonder
  .section/.wrap (voor full-bleed pagina's zoals het beroep-detail).
- Alle overige pagina's + leerling-portaal erven het nieuwe thema via de
  herschreven `style.css` (bestaande classnamen behouden). Admin-css is
  bewust ongemoeid.

### Valkuilen bij dit ontwerp
- `.section a` (0,1,1) wint van componentklassen (0,1,0): nieuwe
  klikcomponenten in een sectie hebben een expliciete
  `text-decoration:none`-regel nodig (zie regel met `.section a.btn`).
- Cache-buster `?v=2` op style.css — **bumpen bij elke CSS-wijziging**.
- Schrijfstijl: geen en/em-dashes, ook niet in settings-waarden
  (`event_time` is in 022 op "18:30 tot 21:30" gezet).
- Migratienummering: er bestonden al twee 021-bestanden; dit werd 022.
  Check altijd even `ls schema/` voor het volgende nummer.

### Open punten na het herontwerp
- Voorlichter-zichtbaarheid: publicatie AAN + 0 bevestigd → vangnet
  (11-9-2026): publieke pagina's tonen aangemelde voorlichters
  (`publiekSprekerFilter` in lib/db.ts) totdat de eerste bevestiging
  binnen is; daarna tellen alleen bevestigde. LET OP: zodra de
  uitnodigingsflow de eerste bevestiging oplevert, krimpt de publieke
  lijst dus bewust naar alleen-bevestigden.
- Jaarfiguur-reeks 2023 t/m 2025 met terugwerkende kracht invullen of pas
  vanaf 2026 opbouwen: keuze Marco.
- Campagneposter (A3-PDF met sectorenfiguur in drie gedaanten): nog te
  maken zodra gewenst.

### E2E-test accounts & mail (10 september 2026)
- **Leerling-flow live getest**: login-POST → magic-link-mail (Resend
  accepteerde zonder fout; token uit `student_tokens` is plaintext, handig
  voor e2e-tests) → verify → ingelogde sessie → beroep gekozen → vraag
  verstuurd. Alles werkend; testdata daarna uit D1 verwijderd.
- **Admin-codemail live getest**: login-POST verstuurt de 6-cijferige code
  zonder Resend-fout (code-rij daarna opgeruimd).
- **LET OP, correctie op eerdere docs: Turnstile staat AAN op productie**
  (`TURNSTILE_SECRET_KEY` is gezet en de widget-key staat in settings).
  Een POST zonder Turnstile-token op /aanmelden en /contact wordt dus
  terecht geweigerd; e2e-testen van die formulieren kan alleen met een
  echte browser(-widget), niet met curl. Voor de mailketen maakt dat niet
  uit: dezelfde `sendEmail` wordt door de wél geteste flows gebruikt.

## Procesinrichting mails & indeling (LIVE, 10 september 2026)

Volledige werkstromen voor voorlichters en leerlingen, gebouwd op een
**mail-outbox met cron** (elke 5 min; `schema/023`, `src/lib/outbox.ts`,
`scheduled()` in index.ts). Principe: procesmails worden klaargezet en om
**9:30 (Europa/Amsterdam)** verstuurd; bevestigingsmails gaan direct.
Alle teksten zijn bewerkbaar in **beheer → Uitgaande mail** (placeholders:
{{naam}} {{voornaam}} {{datum}} {{locatie}} {{rooster}} {{stats}} {{knop}}).

### Voorlichters
1. **Uitnodigen** (beheer → Uitnodigingen): losse adressen of in bulk
   "vorig jaar" (bestaande sprekers met e-mail). Mail bevat een
   persoonlijke link naar `/voorlichter/uitnodiging?token=…`; nieuw =
   leeg formulier, herhaal = vooringevulde gegevens ter controle.
   Insturen → speaker confirmed=1 + directe bevestigingsmail +
   notificatie naar de organisatie.
2. **Herinnering**: automatisch één keer, 7 dagen zonder reactie (cron).
3. **Sponsor**: checkbox op uitnodigings- én aanmeldformulier →
   `sponsor_interest`-vlag + melding in de notificatiemail; logo's beheert
   admin → Sponsoren; sponsorstrook staat op de home.
4. **Indelingsmail** (knop op beheer → Uitgaande mail): rooster + lokaal +
   instructies (aanmeldbalie/badge, lerarenkamer/koffie, enquête-
   aankondiging).
5. **Eventdag-ochtendmail**: automatisch om 9:30 op de dag zelf.
6. **Evaluatiemail**: automatisch op de avond zodra de eerste sessie van
   de spreker begonnen is (rondetijden), met tokenlink `/evaluatie` —
   per sessie deelnemersaantal, vragen, tips, "volgend jaar weer?".
7. **Evaluatie-dashboard** (beheer → Evaluaties): KPI's, filter, volledige
   CSV voor eigen draaitabellen.
8. **Bedankmail + stats**: automatisch gepland op event+10 dagen 9:30;
   tekst vooraf aanpasbaar in Mails, items tot verzending te annuleren.

### Leerlingen
- Minimale data (naam/e-mail); voorkeuren = bestaande picks; NIEUW:
  **tijdblok-blokkades** op het dashboard ("ik kan niet bij ronde X").
- **Automatische indeling** (knop beheer → Uitgaande mail): greedy matching van
  voorkeuren naar sessies per ronde, met blokkades en lokaalcapaciteit
  (default 30; `classrooms.capacity`); herdraaibaar; stats in de flash.
  Daarna knop **indelingsmails leerlingen** (verzending volgende ochtend
  9:30, met rooster + link Mijn avond); rooster ook op het dashboard.
- **Dag-vooraf-mail** automatisch 9:30; **opvolgmail** event+10 dagen.

### Vragen vooraf naar de voorlichter (11-9-2026)
Leerlingen stellen op een beroeppagina "Je vraag aan de voorlichter"
(`student_questions`, per beroep). Twee mailmomenten, via de planner:
- **2 dagen voor de avond, 9:30**: elke bevestigde voorlichter met e-mail
  krijgt de tot dan ingestuurde vragen voor zijn beroep (mailtekst
  `vl_vragen`, bewerkbaar in beheer → Uitgaande mail). Ontdubbeld; **AI-samenvatting
  bij >10 vragen** als `ANTHROPIC_API_KEY` gezet is (haiku), anders een nette
  opsomming (graceful fallback). Voorlichters zonder vragen worden overgeslagen.
- **Ochtend van de avond**: de vragen die ná die mail nog binnenkwamen gaan
  mee in `vl_eventdag` (placeholder `{{vragen}}`, in migratie 026 toegevoegd).
Anoniem (alleen de vraagtekst, geen leerlinggegevens). Kolom
`student_questions.sent_to_speaker` voorkomt dubbel versturen; `bestaatOutbox`
maakt de planner idempotent. Teller per beroep staat in beheer → Vragen vooraf.
Lege mailblokken (bv. `{{vragen}}` zonder vragen) worden in `renderTemplate`
overgeslagen. AAN TE ZETTEN voor AI: `wrangler secret put ANTHROPIC_API_KEY`.

### Beheer & gotchas
- **Outbox**: beheer → Uitgaande mail toont gepland/verzonden/mislukt + annuleren.
  Dedup-keys maken alle planners idempotent (cron mag altijd draaien).
- Cron-config in wrangler.toml (`[triggers] crons`); lokaal testen met
  `wrangler dev --test-scheduled` + `GET /__scheduled?cron=*/5+*+*+*+*`.
- 9:30-berekening: maand-heuristiek voor zomertijd (apr t/m okt = UTC+2);
  rond de omschakeldagen kan de verzendtijd één uur verschuiven.
- {{knop}}-placeholder wordt op de RUWE tekst gedetecteerd (vul() eerst
  zou hem wissen — geleerd tijdens de bouw).
- Secure-cookie + lokale http: curl stuurt de admin-cookie niet mee;
  cookie-jar met `$4="FALSE"` herschrijven (awk) voor lokale flow-tests.
- Jaarlijkse cyclus: nieuwe editie aanmaken → uitnodigingen bulk
  "vorig jaar" → mailteksten nalopen (o.a. slogan/aantallen) → rondes,
  lokalen (capacity!), sessies → indelen → indelingsmails.

## Inkomende mail op de site (code LIVE, 10 september 2026)

De site is voorbereid als eigen MX: Email Routing levert af aan de
`email()`-handler (`src/lib/mailbox.ts`) die elke mail opslaat in
`mail_inbox` (schema/024), bijlagen naar R2 zet (blokkadelijst voor
uitvoerbare/actieve bestanden; inline handtekening-plaatjes overgeslagen),
de afzender automatisch aan een voorlichter koppelt, een
ontvangstbevestiging stuurt (met mail-loop-guard) en een audit-regel
schrijft (`mail_inbox_log`; Workers Logs staan aan via [observability]).
Beheer → **Inkomende e-mail**: lezen, bijlagen downloaden (altijd als download),
beantwoorden in huisstijl (In-Reply-To voor threading), afhandelen,
verwijderen (incl. R2-opruiming).

### Nog te doen door Marco (dashboard, 2 min)
1. Cloudflare → zone → Email → Email Routing → **Enable** (zet de
   MX/SPF-records automatisch).
2. Routing rules → **Catch-all** → actie "Send to Worker" →
   `beroepenavond`.
3. Optioneel vangnet: onder Destination addresses het privéadres
   verifiëren en desgewenst setting `mail_forward_to` zetten; dan wordt
   elke mail óók doorgestuurd. Zonder dit werkt het postvak gewoon.
4. Daarna evt. setting `mail_reply_to` op info@<domein> zetten zodat
   antwoorden op procesmails bij Inkomende e-mail binnenkomen.

### Domeinwissel-checklist (afgesproken: niets domeinvast)
Alle code gebruikt settings (`site_host`, `mail_from`, `mail_to`) en het
ontvangen adres uit het bericht zelf; er staat géén domein hard in code
of schema. Bij een domeinwissel:
1. Settings: `site_host`, `mail_from`, `mail_reply_to` bijwerken.
2. Nieuwe zone: custom domain aan de Worker koppelen (dashboard).
3. Resend: nieuw domein verifiëren (DKIM/SPF-records) zolang Resend de
   verzendweg is.
4. Email Routing op de nieuwe zone aanzetten (stappen hierboven).
5. Turnstile-widget: nieuw domein toevoegen in het Turnstile-dashboard.
6. Oude zone: 301-redirect naar het nieuwe domein laten staan.

### Geplande taak (december 2026): verzending naar Cloudflare Email Sending
Na de editie van 12 november de uitgaande mail migreren van Resend naar
Cloudflare Email Service (Workers Paid, $5/mnd, 3.000 mails inbegrepen,
daarna $0,35/1.000; binding `send_email` → geen API-key meer). LET OP:
nieuwe verzendaccounts hebben een opwarmend dagquotum — ruim vóór de
campagne van 2027 migreren en rustig volume opbouwen. Dan zit ontvangst
én verzending volledig bij Cloudflare in onze eigen Worker.

## Domeinmigratie naar beroepenavond2026.nl (gestart 11-9-2026)

Stand: MIGRATIE VOLTOOID 11-9-2026 (zone actief, SITE_HOST + D1-setting
omgezet, volledige workflowtest groen op het nieuwe domein). Historie:
zone bestond in het account (629f76653401f79fd5f072e5080d46b2,
NS georgia/keanu.ns.cloudflare.com), custom domains apex + www zijn al
aan de Worker gekoppeld via de API, de Worker redirect élke niet-canonieke
host 301 naar SITE_HOST (dus oud domein → nieuw zodra SITE_HOST omgaat).

Volgorde omschakeling (zodra de zone "active" is):
1. wrangler.toml: SITE_HOST = "beroepenavond2026.nl" → push (CI deployt).
2. D1-setting `site_host` → beroepenavond2026.nl (mails/links volgen dan).
3. Volledige test (pagina's, redirect oud→nieuw, leerling-magic-link,
   uitnodiging, admin-code, sitemap/canonical, Turnstile-formulieren).
4. HANDMATIG (Marco, dashboard): Turnstile-widget 0x4AAAAAADqvV4f--hXcokE0
   → nieuwe domeinen toevoegen (API-token mag dit niet); Email Routing op
   de nieuwe zone aanzetten (enable + catch-all → Worker) voor de Mailbox;
   Always Use HTTPS op de nieuwe zone.
5. LATER (MacBook, Resend-key): beroepenavond2026.nl in Resend verifiëren
   en settings mail_from/mail_reply_to omzetten; tot die tijd blijft de
   afzender noreply@inijmegen.com (werkt gewoon).
BLOKKEREND: nameservers bij de registrar op georgia + keanu
.ns.cloudflare.com zetten (alleen Marco kan dit; zone staat op "pending").

## UX-ronde 3 personas (LIVE, 11-9-2026, cachebuster ?v=7)

Volledige UX-scan + verbeteringen voor leerling, voorlichter en
relatiebeheerder, met Playwright echt door de UI gedreven (niet alleen
screenshots) op de lokale dev-server.

### Leerling
- **Beroepen kiezen** (`/leerling/kiezen`, `src/routes/student.ts`): elk
  beroep is nu een toggle-knop (`.pick-btn`, `aria-pressed`) met **live
  zoekveld** (`#kiesZoek`), **teller** ("N beroepen gekozen", `#kiesTeller`,
  `aria-live`) en **lege-staat**. Toggelen gaat via **AJAX** (fetch POST,
  geen herlaad; wisselt `remove.disabled` + knop-klasse/label). No-JS-
  fallback: het blijft een echt `<form class="pick-form">` dat submit.
- **Checkboxes** (nieuwsbrief + tijdblok-blokkades): waren via `.field`
  uitgerekt over de volle breedte (label ver weg). Nu klasse **`.check-row`**
  (flex, `input[type=checkbox]{width:auto}`) → net vinkje met label ernaast;
  nieuwsbrief kreeg een `<noscript>` opslaan-knop.
- Em-dash uit de login-intro gehaald ("geen wachtwoord nodig.").

### Relatiebeheerder (zichtbaarheid van zijn grenzen)
- Nieuw **`src/lib/perms.ts`** = enige bron van waarheid
  (`RELATIEBEHEERDER_BEWERKT` + `relatiebeheerderMagBewerken(path)`), gebruikt
  door zowel de 403-middleware (`routes/admin/index.ts`) als de layout.
- `renderAdminLayout` toont nu een **`.rb-banner`**: op bewerkbare pagina's
  "Relatiebeheerder"-uitleg, op alleen-lees-pagina's een gele
  **"Alleen-lezen"**-balk met snelkoppelingen naar zijn wél-domein
  (Voorlichters, Uitnodigingen, Formulieren). De pagina-body wordt daar in een
  **`<fieldset class="ro-lock" disabled>`** gewikkeld → alle velden grijs en
  niet-interactief. CSS in `admin.css` (`.rb-banner`, `.ro-lock`).
  - GOTCHA (test): een input in `<fieldset disabled>` is functioneel
    vergrendeld en matcht `:disabled` (grijs), maar zijn eigen `.disabled`
    IDL-property blijft `false` → test met `el.matches(':disabled')` of
    visueel, niet met `el.disabled`.

### Openstaand (content-besluit Marco) — BESLIST 11-9-2026
- **Footer-contactadres**: Marco koos `info@beroepenavond2026.nl`. Wordt
  gezet zodra inkomende mail op beroepenavond2026.nl aanstaat (anders
  bouncet info@). Zie sectie hieronder.

## Sessie 11-9-2026 (vervolg) — datum, Turnstile, campagneposter

### Datum editie 2026 gecorrigeerd: donderdag 12 november 2026
De avond is op **donderdag 12 november 2026** (was foutief 20 november; 12
nov is een donderdag, geverifieerd). Doorgevoerd in D1 (`events.date` van
`ev_2026`, settings `event_date`/`event_date_long`) én in alle code-fallbacks
(`EVENT_DATE` in wrangler.toml, home/email/outbox/student/proces). Het
datum-monument `dd.mm` volgt automatisch uit `events.date` (nu 12.11).
Losse hardcoded datum in de home-content (hero_eyebrow, meta_description) en
het nieuwsbericht `datum-2026-bekend` bijgewerkt; in dat bericht stond ook
ten onrechte "Canisius College" → gecorrigeerd naar Montessori College
Nijmegen (venue-settings zijn de bron). VALKUIL: datum staat op meerdere
plekken — settings (live, direct zichtbaar) + code-fallbacks (deploy) +
losse content in pages/announcements. Scan D1-content bij een datumwissel.

### Turnstile-domein na domeinwissel (domeinwissel-checklist punt 5)
De Turnstile-widget stond nog op `inijmegen.com` → op beroepenavond2026.nl
gaf `/aanmelden` "Kan geen verbinding maken met website". Marco heeft in het
Turnstile-dashboard `beroepenavond2026.nl` + `www.` toegevoegd (Hostname
Management). Widget laadt weer (Playwright-geverifieerd). LES: bij elke
domeinwissel is dit een verplichte losse stap; de API-token in `~/.cf-token`
heeft géén Turnstile-edit-recht, dus dit gaat via het dashboard of een
ruimer token.

### Campagneposter A3 (PDF) + download in admin
Nieuwe campagneposter in de Kleurblok-huisstijl: datummonument, jaarfiguur
(de chirurg) in drie gedaanten (Hij/Zij/X), zes categoriekleuren, Archivo
Black self-hosted. Reproduceerbare generator
`scripts/poster/build-poster.mjs` (Playwright, auto-fit-monument voor elke
datum; editie-constanten bovenin spiegelen de D1-settings). Uitvoer:
`public/assets/campagneposter-beroepenavond-2026.pdf`, geserveerd via
`/assets/` en te downloaden via het admin-dashboard (kaart "Materialen").
Bij een nieuwe editie: constanten in het script bijwerken en opnieuw draaien,
dan committen (deploy via push). NB: PDF is schermkwaliteit (RGB, geen
bleed/snijtekens); voor professioneel drukwerk desgewenst een CMYK+bleed-
variant maken.

### Jaarfiguur-reeks: alleen vanaf 2026 (besluit Marco 11-9-2026)
Geen terugwerkende reeks 2023–2025; de jaarfiguur-laag wordt pas vanaf 2026
opgebouwd. Geen codewijziging nodig (huidige gedrag).

### Inkomende mail op beroepenavond2026.nl — LIVE (12-9-2026)
Email Routing staat aan (Marco, dashboard → 3 MX-records naar
`route[1-3].mx.cloudflare.net`). De **catch-all** is via de API gezet op
**AAN → Worker `beroepenavond`** (het token heeft **Email Routing Rules**, dus
regels mogen via de API; het settings-endpoint `/email/routing` enable/dns
blijft een dashboard-stap — die deed Marco). Elke mail aan een
`@beroepenavond2026.nl`-adres komt binnen bij de Worker-`email()`-handler
(`src/index.ts` → `src/lib/mailbox.ts`) en landt in `mail_inbox` (admin →
Mailbox), met loop-guard + optionele auto-reply.
- **Contactadres omgezet naar `info@beroepenavond2026.nl`** op ALLE plekken:
  D1-settings `contact_email` + `mail_reply_to` (footer/contactpagina lezen
  deze live) én de wrangler.toml-var `CONTACT_EMAIL` (bleek overigens nergens
  in code gebruikt, alleen type in env.ts — toch gelijkgetrokken). `mail_to`
  blijft `marco@marcovanthiel.nl` (nieuwe-aanmelding-notificaties in Marco's
  eigen inbox; wil je alles centraal in de Mailbox, zet mail_to dan ook op
  info@). Laatste bouncende fallback in `email.ts` (`|| info@beroepenavond-
  nijmegen.nl`) vervangen door een veilig adres.
- **VALKUIL gevonden 13-9-2026: specifieke adresregel schaduwt de catch-all.**
  Eerste testmail (marco@ -> info@) kwam NIET in de Mailbox omdat er naast de
  catch-all-naar-Worker ook een **specifieke regel `info@beroepenavond2026.nl
  -> forward naar marco@marcovanthiel.nl`** stond. In Cloudflare Email Routing
  wint een literal-adresregel altijd van de catch-all, dus info@ werd naar
  Marco's eigen inbox geforward en bereikte de Worker nooit (mail_inbox én
  mail_inbox_log bleven leeg = handler nooit aangeroepen; dat log is de snelste
  diagnose). Fix (via API, token heeft Email Routing Rules): die regel omgezet
  naar **actie worker -> `beroepenavond`** (regel-tag
  `f880c6ecea7a4609bcb90b459e1e0922`). Beide regels wijzen nu naar de Worker.
  Een persoonlijke kopie blijft komen: de handler forwardt sowieso naar
  `mail_forward_to || mail_to` (`mailbox.ts` r.121); `mail_forward_to` is
  expliciet op `marco@marcovanthiel.nl` gezet (adres is al geverifieerd als
  Email-Routing-bestemming). LES: bij "inbound in de Mailbox gewenst" mag er
  géén literal-forwardregel voor dat adres staan; gebruik de Worker-vangnet
  (`mail_forward_to`) voor een persoonlijke kopie, niet een aparte forwardregel.
- **GEVERIFIEERD WERKEND 13-9-2026:** na de regelwijziging kwamen twee
  testmails naar `info@beroepenavond2026.nl` correct binnen bij de Worker en
  staan in `mail_inbox` (status `nieuw`, `mail_inbox_log.outcome='opgenomen'`),
  zichtbaar in beheer -> Mailbox. Inbound-keten is dus end-to-end rond. De
  leegte in `mail_inbox_log` was de sluitende diagnose: leeg = handler nooit
  aangeroepen (dus upstream/routing), een `fout`-regel = handler draaide maar
  faalde. Zone-id = `629f76653401f79fd5f072e5080d46b2`.

### Onderhoud 12-9-2026
Hono-securitybump `4.12.34 → 4.13.7` (Dependabot: parseBody-DoS + query/SSG-
CVE's; `npm audit fix`, binnen major 4). Typecheck + `wrangler deploy
--dry-run` groen; alleen `package-lock.json` gewijzigd. `npm audit` = 0.

## UX-verbeterronde 2 (36 bevindingen, LIVE 11-9-2026, ?v=8)

Grondige UX-scan van de drie personas (leerling, voorlichter, relatiebeheerder)
via drie parallelle audit-agents; alle bevindingen doorgevoerd en met Playwright
+ curl echt door de flows geverifieerd (lokale dev). Kernpunten:

### Leerling (`src/routes/student.ts`, `studentauth.ts`, `beroepen.ts`, `sections.ts`)
- **Intentie-behoud**: een uitgelogde bezoeker die op een beroeppagina "+ Zet in
  mijn avond" of een vraag verstuurt, verliest dat niet meer. `/leerling/kies` en
  `/leerling/vraag` zetten bij uitgelogd een korte **intent-cookie** (`ba_intent`,
  base64 JSON, 30 min) + redirect naar `/leerling?intent=...&next=<beroeppad>`;
  na de magic-link-login voert `GET /verify` de bewaarde pick/vraag alsnog uit en
  stuurt door naar `next`. `requireStudent` geeft voor GET-routes nu `?next=` mee.
  `next` is altijd afgeschermd (`safeNext`, alleen interne paden).
- Labels aan velden gekoppeld (`for`/`id`) in login + profiel; interesse-checkboxes
  naar `.check-row`. Lege vraag → nette foutmelding i.p.v. valse bevestiging
  (textarea's `required`). Mislukte inlogmail wordt gemeld (`?mailfail=1`, leest
  `requestLogin().mailed`). AJAX-toggle op `/kiezen` checkt `res.ok/redirected`
  (geen valse "gekozen" bij verlopen sessie). Verwijderknop `aria-label`. Vraag-
  status NL ("beantwoord"). Nudge naar interesses bij leeg profiel. `.ics` DTSTAMP.
- Dashboard toont nu ook `?err`-flash. Microcopy geünificeerd ("+ Zet in mijn avond").

### Voorlichter (`src/routes/proces.ts`, `src/lib/email.ts`)
- Uitnodigingsformulier: bij een servervalidatiefout wordt het formulier **opnieuw
  getoond met de ingevulde waarden + een foutmelding** (`uitnodigingPage()` gedeeld
  door GET en POST), niet meer stil geredirect met dataverlies. Native `required`/
  `type=email` vangt de meeste fouten al in de browser; de server is de backstop.
- Verlopen/ongeldige uitnodigingslink → vriendelijke pagina (`ongeldigeUitnodiging()`)
  met "Meld je aan als voorlichter" + mailto-CTA, i.p.v. kale 404.
- Dubbele bevestigingsmail voorkomen (guard op `status='aangemeld'` in de POST).
- Spontane aanmelder (`/aanmelden`) krijgt nu een **warme, dankbare** bevestigingsmail
  (`confirmToSender` splitst op `type==='volunteer'`), niet de koele contact-tekst.
- Alle directe mails hebben een **plaintext-variant** (deliverability). Sponsor-
  checkbox naar `.check-row`, autocomplete op alle velden, verplicht-legenda,
  `<noscript>`-hint bij Turnstile op `/aanmelden` + `/contact`.

### Relatiebeheerder (`admin/layout.ts`, `admin/index.ts`, `admin/account.ts`, `admin.js`, `admin.css`)
- **`data-confirm` werkte niet** (geen JS-handler): toegevoegd in `admin.js` vóór de
  spinner-listener, zodat "Nodig ze allemaal uit" en uitnodiging-verwijderen weer om
  bevestiging vragen.
- **Actieknop-ankers op alleen-lezen pagina's geneutraliseerd**: een `<fieldset
  disabled>` schakelt geen `<a>` uit → CSS `.ro-lock a.btn--primary/.btn--danger
  {pointer-events:none;opacity:.45}`. Geen doodlopende "+ Nieuw"-paden meer.
- **Dashboard niet meer als alleen-lezen** getoond (`isOverview`-uitzondering): zachte
  rol-banner i.p.v. gele "Alleen-lezen"-balk + disabled fieldset.
- **Rolbewuste** snelacties (geen "+ Nieuwsbericht") en checklist-fixknoppen (alleen
  links binnen zijn bewerkdomein). **Contextbewuste banner** per pad (Voorlichters /
  Uitnodigingen / Formulieren / Je eigen account), als `role="note"` met
  `aria-describedby` vanuit het vergrendelde fieldset. Account: e-mailveld `readonly`,
  wachtwoord-doodlopend vervangen door uitleg "inloggen gaat via e-mailcode",
  `roleLabel()` gebruikt. 403-pagina + banner noemen nu ook het eigen account.

### Overig
- **Alle gebruikersgerichte em/en-dashes verwijderd** (harde stijlregel): titel-
  scheiders → ` · `, lege-waarde → `-`, keuze-placeholders → `(geen)`, zin-dashes →
  komma, tijd-ranges → "tot". De winansi-map in `pdf.ts` en de dash-normaliserende
  regex in `home.ts` bewust ongemoeid; resterende dashes staan alleen in code-comments.
- Publieke flash-notices krijgen `role="status"`/`role="alert"`; admin-zoekteller
  `aria-live="polite"`.

## Admin-login: "Log direct in"-knop + DM Sans self-hosted (12-9-2026)

- **Eén-klik-login vanuit de code-mail.** De inlogcode-mail bevat naast de
  6-cijferige code een **"Log direct in"-knop** naar `GET /admin/code?email=…
  &code=…&next=…`. Die GET **verifieert niet**: hij rendert het codeformulier
  met de code al ingevuld en laat het zichzelf **posten** (inline autosubmit-
  script; de site-CSP staat `script-src 'unsafe-inline'` toe). De verificatie
  blijft dus op `POST /admin/code`. Reden: linkscanners die vooraf de link
  ophalen (o.a. **M365 Safe Links**, en Marco's meld-adres zit op M365) doen
  alleen een GET → die mag de eenmalige code niet verbruiken. Het codeveld had
  al `autocomplete="one-time-code"` (telefoon-autofill); de knop dekt ook
  desktop-Chrome, waar e-mailcode-autofill niet bestaat. Code blijft zichtbaar
  als terugval. GET zonder params → 302 naar `/admin/login`; al ingelogd → 302
  naar `/admin`. Playwright-geverifieerd (autosubmit + POST + foutpad).
- **DM Sans is nu self-hosted.** De admin (login-`shell()` én
  `views/admin/layout.ts`) laadde DM Sans van `fonts.googleapis.com`, wat de
  strikte CSP (`style-src 'self' 'unsafe-inline'`, geen googleapis) **blokkeerde**
  → de admin viel al terug op systeemfont, met een geblokkeerde request +
  privacylek naar Google op élke adminpagina. Opgelost: `dmsans-var.woff2`
  (variabel, latin-subset met alle NL-accenttekens; OFL) in
  `public/assets/fonts/` + `@font-face` in `admin.css`, en beide Google-Fonts-
  links verwijderd. `font-src 'self'` dekt het. Playwright bevestigt: geen
  CSP-fouten, font laadt van eigen domein, `document.fonts` heeft 'DM Sans'.
  LES: laad in deze projecten **nooit** Google Fonts (CSP blokkeert + privacy);
  self-host altijd.

## Naamgeving beheer-menu verduidelijkt (13-9-2026)

De "mail-cluster" in het beheermenu had verwarrende namen (Postvak én Mailbox
lazen allebei als "inbox"). Hernoemd naar ondubbelzinnige, distincte labels
(routes/keys ONGEWIJZIGD, alleen labels + koppen + iconen):

| Route | Oud label | Nieuw label | Inhoud |
|---|---|---|---|
| `/admin/inbox` | Postvak (📥) | **Formulieren** (📝) | inzendingen contact-/aanmeldformulieren |
| `/admin/mailbox` | Mailbox (📨) | **Inkomende e-mail** (📥) | echte e-mail aan info@ (mail_inbox) |
| `/admin/mails` | Mails (📬) | **Uitgaande mail** (📤) | sjablonen + outbox/verzendingen |

De twee inkomende bakken staan nu bovenaan de Communicatie-groep gegroepeerd,
elke pagina heeft een uitleg-regel met een kruislink naar de andere, en het
dashboard kreeg een tegel **Nieuwe e-mails** (→ Inkomende e-mail) naast
**Nieuwe formulierberichten** (de Mailbox was voorheen slecht vindbaar). In
oudere changelog-regels hierboven verwijzen "Postvak"/"Mailbox"/"Mails" dus naar
respectievelijk Formulieren / Inkomende e-mail / Uitgaande mail.

## SEO-fixes canonical + /leerling + schema (13-9-2026)

Naar aanleiding van een SEO-audit (Track A + kleine strategische fixes):

- **CRITICAL opgelost: canonical/og:url/BreadcrumbList wezen op alle
  subpagina's naar het OUDE domein inijmegen.com.** Oorzaak: subpagina's
  bouwen hun host uit de D1-setting `site_host`, en die rij ONTBRAK in de
  settings-tabel (de migratie-doc claimde ten onrechte dat hij gezet was),
  dus viel de code terug op de hardcoded default `'inijmegen.com'`. De
  homepage was goed omdat die `c.env.SITE_HOST` (wrangler.toml) gebruikt.
  Tweeledige fix: (1) D1-setting `site_host` gezet op `beroepenavond2026.nl`
  (corrigeert meteen ook maillinks/footer die deze setting live lezen), en
  (2) ALLE code-fallbacks `|| 'inijmegen.com'` voor de linkhost omgezet naar
  `|| 'beroepenavond2026.nl'` (layout.ts, public.ts, student.ts, outbox.ts,
  proces.ts, admin/proces.ts, studentauth.ts, email.ts brand.host) zodat een
  ontbrekende setting nooit meer naar het dode domein terugvalt. LET OP: de
  mail-afzender `mail_from` blijft bewust `noreply@inijmegen.com` (Resend-
  domein beroepenavond2026.nl nog niet geverifieerd; zie eerdere sectie).
- **/leerling lekte in de index.** `renderLayout` heeft nu een optie
  `noindex` → `<meta name="robots" content="noindex,nofollow">`. Het hele
  leerling-portaal rendert via één `page()`-helper in `routes/student.ts`;
  daar staat `noindex: true` (login + dashboard). `public/robots.txt`-regel
  gecorrigeerd van `Disallow: /leerling/` (trailing slash matcht de root
  niet) naar `Disallow: /leerling` (dekt /leerling én /leerling/...), idem
  `Disallow: /admin`.
- **Beroeppagina's**: unieke meta-description per beroep (uit vakgebied +
  waar beschikbaar de werkgevers van de voorlichters, i.p.v. één sjabloon);
  beroepen ZONDER toegewezen publieke voorlichter staan nu op **noindex**
  (dunne content). Signaal = COUNT publieke speakers met dat `beroep_id`,
  los van de publicatieschakelaar.
- **Schema**: `/beroepen` heeft nu naast Organization + BreadcrumbList ook
  een **CollectionPage + ItemList** (alle beroepen met naam + absolute URL).
  Event-JSON-LD op de home: `location.address` is nu een **PostalAddress**
  (parse-helper `postalAddress()` in home.ts) en er is een gratis **Offer**
  (price 0, EUR, InStock) toegevoegd.
- **Trailing slash**: `/beroepen/` gaf 200 met de OUDE "Uitleg per beroep"-
  pagina (via de catch-all), terwijl `/beroepen` de treklijsten toont. Nu
  301't `/beroepen/` naar `/beroepen` (expliciete route vóór de catch-all).
- **Sitemap**: `/beroepen/N`-entries krijgen een `<lastmod>` = laatste
  `speakers.updated_at` voor dat beroep (LEFT JOIN, MAX).
- **robots.txt-kanttekening**: de tweede `User-agent: *`-groep in de LIVE
  robots.txt (het Cloudflare-managed content-signal-blok met de
  AI-crawler-Disallows) wordt door Cloudflare aan de edge vóór ons
  `public/robots.txt` geïnjecteerd; die is NIET vanuit de repo te mergen.
  Ons eigen blok is één schone groep. Samenvoegen/AI-crawlerbeleid (audit
  M1) is een dashboard-keuze, geen codewijziging.

## Search Console: Event-rich-result compleet (14-9-2026)

Google Search Console meldde "Missing field 'offers'" en "Missing field
'performer'" op de Event-JSON-LD van de home (`src/views/home.ts`,
`jsonLd`). `offers` stond er sinds 13-9 al (oudere crawl); `performer`
is toegevoegd als `PerformingGroup` ("N voorlichters uit de
beroepspraktijk", url /voorlichters) en de Offer kreeg `validFrom`.
Daarmee zijn alle door Google aanbevolen Event-velden aanwezig: name,
startDate, endDate, eventStatus, eventAttendanceMode, image,
location.address (PostalAddress), organizer, performer, offers (price,
priceCurrency, availability, validFrom, url), description, url.
Bewust géén 169 losse `Person`-performers: onnodig zwaar en privacy-
gevoeliger; de groep volstaat voor de rich result. Na zo'n fix: in
Search Console bij het probleem "Validate fix" klikken of de home via
URL-inspectie opnieuw laten indexeren; de edge-cache (s-maxage=300) op
de home betekent dat een live-check tot 5 minuten oud kan zijn.

## Plattegronden gedigitaliseerd (14-9-2026)

Bron: de scan "Beuk nummering ruimtes definitief" (clipL2R
interieurarchitecten, tek. B100 t/m B105, update 30 oktober 2013), vijf
A3-bladen met de handgeschreven, definitieve ruimtenummering. Bouwlaag 0
tot en met 4 is verwerkt; bouwlaag 5 en 6 en de parkeergarage (P01 t/m
P05) bewust niet, daar vinden geen sessies plaats.

**Bestanden**

- `public/assets/plattegrond/bouwlaag-N.svg` - vereenvoudigd nagetekende
  vectorplattegrond per bouwlaag, zonder lokaalnummers. Die worden door
  `/rooster` zelf over de klikvlakken getekend, dus dubbel zetten zou
  rommelig worden.
- `public/assets/plattegrond/bouwlaag-N-genummerd.svg` - dezelfde
  tekening met nummer, functie en oppervlakte, voor print en voor de
  bewegwijzering op de avond zelf.
- `public/assets/plattegrond/plattegronden-montessori-college.pdf` - alle
  vijf bouwlagen achter elkaar.
- `docs/lokalen-montessori-college.csv` - het volledige lokalenregister.

**Bron van waarheid**

`scripts/plattegrond/rooms.py` bevat het register met coordinaten,
`scripts/plattegrond/gen.py` genereert daaruit de SVG's, de migratie en de
CSV. Een lokaal verplaatsen of hernoemen doe je in `rooms.py`, daarna
`python3 scripts/plattegrond/gen.py` en de bestanden uit `out/` kopieren.
Handmatig in de SVG's knippen loopt bij de volgende generatie vast.

**Data**

`schema/027_plattegronden.sql` zet 5 floorplans en 86 classrooms. De
migratie is idempotent (begint met DELETE op de prefixen `fp_mcn_` en
`cr_mcn_`) en hangt zichzelf aan het actieve event via een subquery, dus
geen hardgecodeerd `ev_2026`.

Elke bouwlaag heeft een eigen viewBox die bij `0 0` begint; de rects in
`classrooms.map_shape` staan in datzelfde stelsel. Achtergrond en
klikvlakken vallen daardoor exact over elkaar, ook op mobiel.

Alleen les-, leerplein- en bijzondere ruimten (49 stuks) hebben een
`map_shape`. Kantoren, bergingen en techniek (37 stuks) staan wel in
`classrooms` maar zonder vlak, anders wordt de publieke kaart een lappendeken
van grijze blokjes. Is er toch een vlak nodig: natekenen in
`/admin/floorplan-editor`.

**Toepassen**

De lokale D1 is in deze sessie al bijgewerkt. Remote nog doen:
`npx wrangler d1 execute beroepenavond --remote --file=schema/027_plattegronden.sql`

Let op: `node_modules` op de Mac is darwin-arm64, dus wrangler draait niet
in de Linux-VM van de Cowork-bridge ("You installed workerd on another
platform"). Wrangler-commando's altijd in een echte terminal op de Mac.

**Twee onzekerheden uit de scan**

- De ingang-markering op bouwlaag 0 staat bij de receptie (007). De
  tekening benoemt zelf geen hoofdingang; controleren voor de avond.
- De handgeschreven nummers 017 (berging, 2 m2) en 018 (technische
  ruimte, 5 m2) zijn slecht leesbaar. Staan ze omgekeerd, wissel dan de
  codes in `rooms.py` en genereer opnieuw.

### Auto-deploy hersteld (14-9-2026)

Runs #121 en #122 faalden, niet op het R2-token maar op de versiepin zelf.
`cloudflare/wrangler-action` doet in de stap "Installing Wrangler" een
`npm i wrangler@<wranglerVersion>`, en `wrangler@4.107.0` vraagt
peerOptional `@cloudflare/workers-types@^4`, terwijl deze repo op `^5`
zit. Resultaat: `npm error code ERESOLVE`, exitcode 1, deploy weg.

Opgelost door `wranglerVersion` in `deploy.yml` op `4.131.0` te zetten,
de versie uit package.json en package-lock. Run #123 is groen (31s).
De pin blijft dus staan, maar hij moet meebewegen met package.json: zet
je wrangler daar op een nieuwe versie, pas dan ook de workflow aan.

Let op: de bekende R2-token-kwestie uit juni speelt hier niet meer; de
deploys #107 tot en met #120 waren allemaal groen.

## Lokalen: aanvinklijst wel/niet gebruikt (16-9-2026)

Beheer -> Lokalen (`/admin/classrooms`) is nu een **aanvinklijst** van alle
86 ruimten met per rij een **Gebruikt-vinkje** plus de bekende info: code,
naam (incl. m2), soort, verdieping, capaciteit en of het lokaal op de kaart
staat. Bovenaan een zoekfilter (op code/naam/soort/verdieping) met een live
teller "X van Y gebruikt" en knoppen "Alles in beeld aan/uitvinken" (werken
alleen op de door de zoekfilter zichtbare rijen). Onderaan een sticky
Opslaan-knop. Alles werkt zonder JS (server-side POST); admin.js is enkel
verfraaiing (live teller + alles-aan/uit).

- **Schema `028_lokaal_gebruik.sql`**: kolom `classrooms.in_use INTEGER NOT
  NULL DEFAULT 1`. Default AAN voor de 49 les-/leerplein-/bijzondere ruimten
  (die een `map_shape` hebben), UIT voor de 37 dienstruimten (kantoren,
  bergingen, techniek) zonder vlak. Lokaal + remote toegepast (49/37).
- **Opslaan-route `POST /admin/classrooms/gebruik`** staat bewust VOOR `/:id`
  (anders vangt `/:id` "gebruik" op). Body via `parseBody({ all: true })`
  zodat de meervoudige `use`-checkboxes als array binnenkomen (zelfde
  workerd-valkuil als de speakers-bulk; `formData()` gaf lege arrays). De
  route zet eerst alle lokalen van de editie op 0 en daarna de aangevinkte
  ids via `IN (...)` op 1.
- **Soort** komt uit `classrooms.notes` (import-waarde les/open/bijz/dienst),
  vertaald door `soortLabel()` naar leesbare tekst. De m2 zit in `name`.
- **in_use** is ook per lokaal te zetten op het bewerk-/nieuw-formulier.
- Nog niet gekoppeld aan de publieke kaart of de automatische indeling; die
  tonen/gebruiken lokalen nog los van `in_use`. Wil je dat de indeling alleen
  gebruikte lokalen vult of de publieke kaart de niet-gebruikte verbergt: filter
  dan op `in_use = 1` in `src/lib/indeling.ts` resp. `src/views/rooster.ts`.
- LET OP bij regeneratie plattegrond: `027` doet DELETE+INSERT van de
  `cr_mcn_`-lokalen en zet `in_use` daarmee terug op de default; draai `028`
  daarna opnieuw (idempotent) of neem de keuze over.

### Lokalen: smartboard, sorteren/filteren, gedimde plattegrond (16-9-2026)

Vervolg op de aanvinklijst, in één ronde:

- **Smartboard-kolom** (`schema/030_smartboard.sql`: `classrooms.smartboard`
  INTEGER NOT NULL DEFAULT 0). Ja/nee-vinkvak per rij in de lijst (naast
  Gebruikt) en op het bewerk-/nieuw-formulier. Opslaan loopt via dezelfde
  `POST /admin/classrooms/gebruik`: die verwerkt nu twee checkbox-sets
  (`use` + `sb`), elk met het patroon "alles op 0, aangevinkte op 1". Er zijn
  vier bulkknoppen (gebruikt ja/nee, smartboard ja/nee) die alleen de door de
  filter zichtbare rijen aanpassen.
- **Sorteren + filteren op alle koppen.** De lijst is `<table data-sortfilter>`
  met twee koprijen: `tr.sf-head` (klikbare `<th data-sort="text|num|bool">`)
  en `tr.sf-filter` (per kolom een `data-sf-filter="<index>"`-control:
  ja/nee-select voor Gebruikt/Smartboard, select voor Soort/Verdieping,
  zoekveld voor Code/Naam/Cap.). Een los `data-sf-search="lok"` zoekt in alle
  kolommen. Generieke module in `admin.js` (`table[data-sortfilter]`):
  kolomindex = celindex; cellen dragen `data-sf` met de sorteer-/filterwaarde
  (checkbox-cellen "1"/"0", cap = getal), dat wordt bij toggelen bijgewerkt zodat
  sorteren klopt. Werkt zonder JS (dan gewoon de volledige lijst). De oude
  losse `filterBar` is voor deze lijst vervangen door deze module. De kolom
  "Kaart" is weg (na 029 heeft elk lokaal een vlak, dus altijd gelijk).
- **Plattegrond toont niet-gebruikte ruimten gedimd.** `schema/029_lokaal_shapes.sql`
  geeft de 37 dienstruimten alsnog een `map_shape` (gegenereerd door
  `scripts/plattegrond/gen029.py` uit dezelfde framing als 027; idempotent,
  raakt `in_use` niet). `src/views/rooster.ts` selecteert nu `in_use`: ruimten
  met `in_use = 0` worden als niet-klikbaar, gedimd vlak (`.map-room-off`,
  gestreepte grijze rand, grijs label) getekend en staan NIET in de modal-data;
  legenda kreeg "Niet in gebruik". Zo blijft elke ruimte zichtbaar terwijl
  alleen de gebruikte klikbaar/gekleurd zijn.
  - VALKUIL/drift: de gecommitte `027` heeft 49 shapes, maar `gen.py` genereert
    er inmiddels 86. Regenereren + 027 opnieuw toepassen zou dus alle shapes
    zetten EN `in_use`/028 in de war schoppen (028's default hangt aan
    "map_shape IS NULL"). Daarom NIET 027 opnieuw uitrollen; de live-stand is
    027(49) + 028 + 029(37) + 030. Bij een echte nieuwe editie: 027 -> 028 ->
    029 -> 030 in die volgorde (028 draait vóór 029, dus de default klopt nog).

### Admin-zijbalk: menugroepen in-/uitklapbaar (16-9-2026)

Elke navigatiegroep in de zijbalk is nu een `<details class="nav-group"
data-group="...">` met `<summary class="nav-group__title">` (chevron ▸ die
draait). Native, werkt zonder JS en toetsenbord-toegankelijk. `admin.js`
onthoudt de open/dicht-stand per groep in `localStorage` (`ba_nav_groups`);
de groep met de actieve pagina staat altijd open (overschrijft de opgeslagen
stand). CSS in `admin.css` (`.nav-group__title`, chevron via `::before`).
