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
