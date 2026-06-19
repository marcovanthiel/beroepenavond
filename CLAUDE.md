# CLAUDE.md — Beroepenavond Nijmegen

## Project

Website voor de **Beroepenavond Nijmegen** — een jaarlijkse
voorlichtingsavond door **Rotary Club Nijmegen-Stad en Land** in
samenwerking met de **decanen van de middelbare scholen in Nijmegen**,
gehost op het **Canisius College**.

- **Datum 2026**: donderdag 20 november 2026
- **Bron-content**: gekopieerd van `beroepenavondnijmegen.nl` (mei 2026)
- **Live**: `https://inijmegen.com/` zodra het custom domain gekoppeld is

## Architectuur

Cloudflare Worker met Hono + D1 (content + sessies + sprekers).
Statische assets via ASSETS-binding gemount onder `/assets/*`.
Patroon hetzelfde als bij `inijmegen.nl`.

- **Account-ID**: `04865fcd4034789d3970c1b51950227c`
- **Zone-ID inijmegen.com**: `ae640a240c4ce0a2a5c309f349c93a37`
- **D1**: `beroepenavond` (`8bb285c2-b8be-40bb-98c3-8e58635c47d9`)
- **R2** (te maken): `beroepenavond-assets`

## Domein

Gehost op `inijmegen.com` (let op: `.com`, niet `.nl` — `.nl` is voor
de Stichting Gemeenschapsservice).

## Data-model

- **events**: jaarlijkse avond (één actief tegelijk via `is_active`)
- **rounds**: voorlichtingsrondes binnen een avond
- **categories**: beroepscategorieën (6 stuks)
- **speakers**: voorlichters met contactgegevens, foto, biografie
- **classrooms**: lokalen met optionele `map_shape` (JSON met polygon-
  coördinaten voor de plattegrond)
- **floorplans**: één of meerdere plattegronden per event
- **sessions_program**: één beroepssessie (event × ronde × lokaal ×
  category × sprekers)
- **session_speakers**: M-op-M tussen sessies en sprekers
- **users / sessions / audit_log / settings / pages**: standaard CMS-tabel

## Deploy

```
push naar main → .github/workflows/deploy.yml
              → cloudflare/wrangler-action@v3
              → wrangler deploy
              → Worker live in ~20s
```

GH secrets nodig: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Initiële DB-setup

```bash
npm run db:apply:remote   # schema/001_init.sql + 002_seed.sql
```

Eerste user aanmaken: via een nog-te-bouwen `scripts/create-first-
user.sh` (PBKDF2-hash voor wachtwoord).

## Status (19 juni 2026)

- **Klaar**: project-skelet, schema, seed-content (5 pages + 6
  categorieën + actief event), Hono-routing, publieke layout +
  markdown-render.
- **Te doen**: admin-UI, session-login, speakers/classrooms/floorplan-
  CRUD, plattegrond-interactie (klikbare polygons), R2-koppeling voor
  uploads, eerste user aanmaken, custom domain koppelen.

## Bron

`beroepenavondnijmegen.nl` is WordPress. Bij wijziging van de
publieke content: edit de relevante row in `pages` via admin (later),
of pas `schema/002_seed.sql` aan en draai `db:apply:remote`.
