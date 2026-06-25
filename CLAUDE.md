# CLAUDE.md — Beroepenavond Nijmegen

> Overdrachtsdoc. Lees dit bestand bij sessie-start zodat je op elke
> computer (MacBook én Mac mini) verder kunt zonder context te
> reconstrueren. `git fetch && git pull` eerst draaien — Marco werkt
> vanaf meerdere machines.

## Project

Website voor de **Beroepenavond Nijmegen** — jaarlijkse
voorlichtingsavond door **Rotary Club Nijmegen-Stad en Land** samen met
de **decanen van de middelbare scholen in Nijmegen e.o.**, gehost op
het **Canisius College**.

- **Datum 2026**: donderdag 20 november 2026, 18:30 – 21:30
- **Live**: `https://inijmegen.com/` (NB: `.com`, niet `.nl` — die is van
  Stichting Gemeenschapsservice)
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
- **SEO**: dynamische `/sitemap.xml` (uit pages + nieuws), JSON-LD Event
  op home, OG/canonical overal.

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
