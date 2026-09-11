/**
 * Beroepen (herontwerp 2026): treklijsten-overzicht + beroep-detail.
 *
 * - /beroepen: alle zes categorieën als uitklapbare kleurbalken
 *   (native details/summary, werkt zonder JS). ?cat=<id> klapt die
 *   categorie server-side open, dus ook JS-loos correct.
 * - /beroepen/:id: beroep-detail met categorie-mini-strip en
 *   beroep-blokjes bovenin, voorlichters, rondes/lokaal en de
 *   leerling-acties ("+ Zet in mijn avond" met uitleg-tooltip).
 */
import type { Context } from 'hono';
import type { Env } from '../env';
import { getNavPages, getSettings, publiekSprekerFilter } from '../lib/db';
import { renderLayout } from './layout';
import { categoriePictogram, tekstOp } from './figuur';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

interface CatRow { id: string; name: string; color: string | null; }
interface BeroepRow { id: number; category_id: string | null; name: string; description_md: string | null; }

async function speakerCounts(db: Env['DB']): Promise<Map<number, number>> {
  const filter = await publiekSprekerFilter(db);
  const rows = await db
    .prepare(`SELECT beroep_id, COUNT(*) AS n FROM speakers WHERE ${filter} AND beroep_id IS NOT NULL GROUP BY beroep_id`)
    .all<{ beroep_id: number; n: number }>();
  const map = new Map<number, number>();
  for (const r of rows.results ?? []) map.set(r.beroep_id, r.n);
  return map;
}

// ----------------------------------------------------------------------
// /beroepen — treklijsten
// ----------------------------------------------------------------------

export async function renderBeroepenPagina(c: Context<{ Bindings: Env }>) {
  const db = c.env.DB;
  const openCat = c.req.query('cat') ?? '';
  const [settings, navItems, cats, beroepen] = await Promise.all([
    getSettings(db),
    getNavPages(db),
    db.prepare('SELECT id, name, color FROM categories ORDER BY sort_order').all<CatRow>(),
    db.prepare('SELECT id, category_id, name, description_md FROM beroepen ORDER BY category_id, sort_order, name').all<BeroepRow>(),
  ]);
  const published = (settings['voorlichters_published'] ?? '0') === '1';
  const counts = published ? await speakerCounts(db) : new Map<number, number>();

  const byCat = new Map<string, BeroepRow[]>();
  for (const b of beroepen.results ?? []) {
    const k = b.category_id ?? '_none';
    (byCat.get(k) ?? byCat.set(k, []).get(k)!).push(b);
  }

  const accs = (cats.results ?? [])
    .map((cat) => {
      const items = byCat.get(cat.id) ?? [];
      const kleur = cat.color || '#0d0d0d';
      const rijen = items
        .map((b) => {
          const n = counts.get(b.id) ?? 0;
          const rechts = published
            ? `${n} voorlichter${n === 1 ? '' : 's'} <span class="pijl" aria-hidden="true">→</span>`
            : `<span class="pijl" aria-hidden="true">→</span>`;
          return `<a class="acc-rij" href="/beroepen/${b.id}"><b>${esc(b.name)}</b><span class="n">${rechts}</span></a>`;
        })
        .join('\n');
      const open = cat.id === openCat ? ' open' : '';
      return `<details class="acc" id="cat-${esc(cat.id)}" style="--acc-c:${esc(kleur)}"${open}>
        <summary style="background:${esc(kleur)};color:${tekstOp(kleur)}">${esc(cat.name)}<span class="som"><em>${items.length} beroepen</em><span class="chev" aria-hidden="true">+</span></span></summary>
        <div class="acc__paneel">${rijen}</div>
      </details>`;
    })
    .join('\n');

  const body = `
    <p class="acc-hint">Klap een categorie uit en klik op een beroep${published ? ' voor de voorlichters' : ''}.</p>
    ${accs}
    <div class="werf">
      <p><b>Mis je jouw vak?</b> We zoeken nog voorlichters. Eén avond per jaar, het beste publiek dat er bestaat.</p>
      <a class="btn btn--primary" href="/aanmelden">Word voorlichter</a>
    </div>`;

  return c.html(
    renderLayout({
      title: 'Alle beroepen — Beroepenavond Nijmegen',
      metaDescription: `Alle beroepen op de Beroepenavond, verdeeld over ${(cats.results ?? []).length} vakgebieden. Klik door naar de voorlichters per beroep.`,
      navItems,
      activeSlug: '/beroepen',
      breadcrumbs: [{ label: 'Beroepen' }],
      canonicalPath: '/beroepen',
      hero: { eyebrow: 'Ontdek je toekomst', title: 'Alle beroepen', compact: true },
      bodyHtml: body,
      settings,
    })
  );
}

// ----------------------------------------------------------------------
// /beroepen/:id — detail
// ----------------------------------------------------------------------

export async function renderBeroepDetail(c: Context<{ Bindings: Env }>, beroepId: number) {
  const db = c.env.DB;
  const beroep = await db
    .prepare('SELECT id, category_id, name, description_md FROM beroepen WHERE id = ?')
    .bind(beroepId)
    .first<BeroepRow>();
  if (!beroep) return null;

  const [settings, navItems, cats, siblings, sessies] = await Promise.all([
    getSettings(db),
    getNavPages(db),
    db.prepare('SELECT id, name, color FROM categories ORDER BY sort_order').all<CatRow>(),
    db.prepare('SELECT id, name FROM beroepen WHERE category_id = ? ORDER BY sort_order, name').bind(beroep.category_id).all<{ id: number; name: string }>(),
    db.prepare(
      `SELECT r.round_no, cl.code AS lokaal, cl.floor AS verdieping
       FROM sessions_program sp
       LEFT JOIN rounds r ON r.id = sp.round_id
       LEFT JOIN classrooms cl ON cl.id = sp.classroom_id
       WHERE sp.beroep_id = ? AND sp.is_public = 1
         AND sp.event_id = (SELECT id FROM events WHERE is_active = 1 LIMIT 1)
       ORDER BY r.round_no`
    ).bind(beroepId).all<{ round_no: number | null; lokaal: string | null; verdieping: string | null }>(),
  ]);

  const published = (settings['voorlichters_published'] ?? '0') === '1';
  const cat = (cats.results ?? []).find((x) => x.id === beroep.category_id) ?? null;
  const kleur = cat?.color || '#0d0d0d';
  const opKleur = tekstOp(kleur);

  const sprekers = published
    ? (await db
        .prepare(`SELECT full_name, job_title, organization, portrait_url, linkedin FROM speakers WHERE ${await publiekSprekerFilter(db)} AND beroep_id = ? ORDER BY full_name`)
        .bind(beroepId)
        .all<{ full_name: string; job_title: string | null; organization: string | null; portrait_url: string | null; linkedin: string | null }>()).results ?? []
    : [];

  // Categorie-mini-strip (context blijft zichtbaar, actieve categorie gemarkeerd).
  const miniStrip = (cats.results ?? [])
    .map((x) => {
      const k = x.color || '#0d0d0d';
      const actief = x.id === beroep.category_id ? ' aria-current="true"' : '';
      return `<a href="/beroepen?cat=${esc(x.id)}" style="background:${esc(k)};color:${tekstOp(k)}"${actief}>${esc(x.name)}</a>`;
    })
    .join('');

  // Beroep-blokjes binnen de categorie (max 12 + "alle N").
  const sibs = siblings.results ?? [];
  const tabs = sibs
    .slice(0, 12)
    .map((s) =>
      s.id === beroep.id
        ? `<a href="/beroepen/${s.id}" aria-current="page" style="color:${opKleur === '#ffffff' ? esc(kleur) : '#0d0d0d'}">${esc(s.name)}</a>`
        : `<a href="/beroepen/${s.id}">${esc(s.name)}</a>`
    )
    .join('');
  const tabsMeer = `<a class="meer" href="/beroepen?cat=${esc(beroep.category_id ?? '')}">alle ${sibs.length} →</a>`;

  // Ronde/lokaal-regel uit het programma (alleen als er sessies zijn).
  const sesRows = (sessies.results ?? []).filter((s) => s.round_no != null);
  const rondes = [...new Set(sesRows.map((s) => s.round_no))];
  const lokaal = sesRows.find((s) => s.lokaal)?.lokaal ?? null;
  const verdieping = sesRows.find((s) => s.verdieping)?.verdieping ?? null;
  const metaHtml =
    rondes.length || lokaal
      ? `<div class="ber-meta">
          ${rondes.length ? `<div><b>Ronde ${rondes.join(' &amp; ')}</b><span>25 minuten per ronde</span></div>` : ''}
          ${lokaal ? `<div><b>Lokaal ${esc(lokaal)}</b>${verdieping ? `<span>${esc(verdieping)}</span>` : '<span>zie plattegrond</span>'}</div>` : ''}
        </div>`
      : '';

  const sprekersHtml = published
    ? sprekers.length
      ? sprekers
          .map((s) => {
            const foto = s.portrait_url
              ? `<img class="foto" src="${esc(s.portrait_url)}" alt="" loading="lazy" decoding="async">`
              : `<div class="foto" style="background:${esc(kleur)};color:${tekstOp(kleur)}" aria-hidden="true">${esc(initials(s.full_name))}</div>`;
            const acties = [
              s.linkedin ? `<a href="${esc(s.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a>` : '',
              `<a href="#vraag">Vraag vooraf stellen</a>`,
            ].filter(Boolean).join('');
            return `<div class="spreker-rij">${foto}<div><h3>${esc(s.full_name)}</h3><div class="rol">${esc([s.job_title, s.organization].filter(Boolean).join(', '))}</div><div class="acties">${acties}</div></div></div>`;
          })
          .join('')
      : `<div class="callout"><p>Voor dit beroep is nog geen voorlichter bekendgemaakt. Houd deze pagina in de gaten.</p></div>`
    : `<div class="callout"><p>De voorlichters voor deze editie worden binnenkort bekendgemaakt.</p></div>`;

  const uitleg = 'Dit beroep komt in je persoonlijke rooster: je krijgt een ronde en het lokaal erbij. De voorlichter ziet vooraf wie er komen en welke vragen er leven, en kan zich zo op jou voorbereiden.';

  const body = `
<div class="mini-strip" role="navigation" aria-label="Categorieën">${miniStrip}</div>
<div class="ber-kop" style="background:${esc(kleur)};color:${opKleur}">
  <div class="wrap">
    <div class="pad">${esc(cat?.name ?? 'Beroep')}</div>
    <nav class="ber-tabs" aria-label="Beroepen in ${esc(cat?.name ?? 'deze categorie')}">${tabs}${tabsMeer}</nav>
    <h1>${esc(beroep.name)}</h1>
  </div>
</div>
<div class="section"><div class="wrap">
  <div class="ber-body">
    <div>
      ${beroep.description_md ? `<p class="lede" style="margin-bottom:0">${esc(beroep.description_md)}</p>` : ''}
      ${metaHtml}
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:18px">
        <span class="tipwrap">
          <form method="post" action="/leerling/kies" class="inline-form">
            <input type="hidden" name="beroep_id" value="${beroep.id}">
            <button class="btn btn--primary btn--lg" type="submit" aria-describedby="tip-avond">+ Zet in mijn avond</button>
          </form>
          <span class="tip" role="tooltip" id="tip-avond"><b>Wat gebeurt er?</b><br>${esc(uitleg)}</span>
        </span>
        <a class="btn btn--ghost btn--lg" href="#vraag">Stel je vraag vast</a>
      </div>
      <p class="cta-uitleg">${esc(uitleg)}</p>
      <p class="muted" style="font-size:.85rem;margin-top:14px">Nog geen account? Je logt zo in met alleen je e-mailadres via <a href="/leerling">Mijn avond</a>.</p>
      <form method="post" action="/leerling/vraag" id="vraag" style="margin-top:26px;max-width:560px">
        <input type="hidden" name="beroep_id" value="${beroep.id}">
        <div class="field"><label for="vraag-tekst">Je vraag aan de voorlichter</label>
          <textarea id="vraag-tekst" name="question" rows="3" placeholder="Bijv. welke opleiding heb je gevolgd? Wat verdien je?"></textarea></div>
        <button class="btn btn--ghost" type="submit">Vraag versturen</button>
      </form>
    </div>
    <div>
      ${sprekersHtml}
      <div class="werf">
        <p><b>Werk jij als ${esc(beroep.name.toLowerCase())}?</b> Geef je vak door aan wie het straks overneemt.</p>
        <a class="btn btn--primary" href="/aanmelden">Word voorlichter</a>
      </div>
    </div>
  </div>
</div></div>`;

  return c.html(
    renderLayout({
      title: `${beroep.name} — Beroepenavond Nijmegen`,
      metaDescription: beroep.description_md || `${beroep.name} op de Beroepenavond Nijmegen: ontmoet de professionals en stel je vragen.`,
      navItems,
      activeSlug: '/beroepen',
      canonicalPath: `/beroepen/${beroep.id}`,
      hero: null,
      bare: true,
      breadcrumbs: [{ label: 'Beroepen', href: '/beroepen' }, { label: beroep.name }],
      bodyHtml: body,
      settings,
    })
  );
}
