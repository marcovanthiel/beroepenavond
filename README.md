# Beroepenavond Nijmegen

Website voor de jaarlijkse Beroepenavond — Rotary Club Nijmegen-Stad en Land × Canisius College.

- **Live**: https://inijmegen.com/ (na koppeling)
- **Bron-content**: `beroepenavondnijmegen.nl`
- **Stack**: Cloudflare Worker (Hono) + D1 + (R2)

Zie `CLAUDE.md` voor de volledige werkwijze.

## Lokaal

```bash
npm install
npm run db:apply:local
npm run dev    # wrangler dev op :8787
```

## Deploy

Push naar `main` → GitHub Actions deployt automatisch.
