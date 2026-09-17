/** Individuele beroepen, gegroepeerd per categorie. PK = INTEGER. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  textarea,
  select,
  formActions,
  deleteButton,
  flashFromQuery,
  filterBar,
  filterEmptyRow,
  emptyState,
  backLink,
} from '../../views/admin/layout';
import { str, strOrNull, intOr, redirectOk, redirectErr, slugify } from '../../lib/forms';
import { getActiveEvent } from '../../lib/db';
import { loadBezoek, verwachtAantal, saveBezoekVelden, saveBezoekJaar, type BezoekRij } from '../../lib/bezoek';

/** Badge-tekst voor de herkomst van een leerlingenaantal. */
function bronBadge(bron: string): string {
  return bron === 'evaluatie'
    ? '<span class="badge badge--on" title="Automatisch uit de voorlichter-evaluaties">evaluaties</span>'
    : '<span class="badge badge--off" title="Handmatig ingevoerd">handmatig</span>';
}

/** Jaren die op het beroepformulier invulbaar zijn: de vier edities tot en met
 *  de actieve, plus jaren waar al een aantal voor bestaat. */
function bezoekJaren(actiefJaar: number, bestaand: BezoekRij[]): number[] {
  const s = new Set<number>();
  for (let j = actiefJaar; j >= actiefJaar - 3; j--) s.add(j);
  for (const r of bestaand) s.add(r.jaar);
  return [...s].sort((a, b) => b - a);
}

/** Kaart "Leerlingen per editie" op het beroepformulier. */
function bezoekKaart(actiefJaar: number, bestaand: BezoekRij[]): string {
  const perJaar = new Map(bestaand.map((r) => [r.jaar, r]));
  const rijen = bezoekJaren(actiefJaar, bestaand)
    .map((j) => {
      const r = perJaar.get(j);
      return `<tr>
        <th scope="row" style="text-align:left">${j}${j === actiefJaar ? ' <span class="muted">(deze editie)</span>' : ''}</th>
        <td><input class="fld__input" type="number" min="0" max="2000" inputmode="numeric" name="bezoek_${j}" value="${r ? r.aantal : ''}" aria-label="Aantal leerlingen in ${j}" style="max-width:120px"></td>
        <td>${r ? bronBadge(r.bron) : '<span class="muted">-</span>'}</td>
      </tr>`;
    })
    .join('');
  return `<div class="card">
    <h2 style="margin-top:0">Leerlingen per editie</h2>
    <p class="muted">Hoeveel leerlingen dit beroep per editie trok. De sessie-indeling gebruikt het <strong>laatst bekende jaar</strong> om een passend lokaal te kiezen (groot beroep, groot lokaal) en om drukke beroepen over de tijdvakken te spreiden. Het aantal van de avond zelf komt automatisch uit de evaluaties van de voorlichters; wat je hier intypt gaat vóór.</p>
    <div class="table-wrap" style="max-width:460px"><table class="data">
      <thead><tr><th>Editie</th><th>Leerlingen</th><th>Bron</th></tr></thead>
      <tbody>${rijen}</tbody>
    </table></div>
    <p class="muted" style="margin-top:8px">Alle beroepen in één keer invullen? Gebruik <a href="/admin/beroepen/aantallen">Leerlingenaantallen invoeren</a>.</p>
  </div>`;
}

/** Bepaalt een unieke slug voor een beroep. Gebruikt de ingevulde slug of
 *  anders de naam; voegt -2, -3, ... toe bij botsing (self uitgezonderd). */
async function uniekeBeroepSlug(db: any, wens: string, naam: string, exclId: number | null): Promise<string> {
  const basis = slugify(wens || naam);
  let slug = basis;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = exclId != null
      ? await db.prepare('SELECT id FROM beroepen WHERE slug = ? AND id != ?').bind(slug, exclId).first()
      : await db.prepare('SELECT id FROM beroepen WHERE slug = ?').bind(slug).first();
    if (!row) return slug;
    slug = `${basis}-${n++}`;
  }
}
import { buildWerflijstPdf } from '../../lib/pdf';

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export const beroepenApp = new Hono<AdminEnv>();

interface Beroep {
  id: number;
  category_id: string;
  name: string;
  slug: string | null;
  sort_order: number;
  description_md: string | null;
}

async function catOptions(c: any): Promise<{ value: string; label: string }[]> {
  const cats = await c.env.DB.prepare('SELECT id, name FROM categories ORDER BY sort_order').all();
  return (cats.results ?? []).map((x: any) => ({ value: x.id, label: x.name }));
}

beroepenApp.get('/', async (c) => {
  const filter = c.req.query('filter') === 'zonder' ? 'zonder' : 'alle';
  const rows = await c.env.DB.prepare(
    `SELECT b.*, cat.name AS cat_name, cat.color AS cat_color, cat.sort_order AS cat_order,
            (SELECT COUNT(*) FROM speakers s WHERE s.beroep_id = b.id) AS n_speakers
       FROM beroepen b LEFT JOIN categories cat ON cat.id = b.category_id
      ORDER BY cat.sort_order, b.sort_order`
  ).all<Beroep & { cat_name: string; cat_color: string; cat_order: number; n_speakers: number }>();
  const all = rows.results ?? [];
  const zonder = all.filter((r) => r.n_speakers === 0);
  const showing = filter === 'zonder' ? zonder : all;
  const bezoek = await loadBezoek(c.env.DB);

  const list = showing
    .map((r) => {
      const vw = verwachtAantal(bezoek, r.id);
      return `<tr>
        <td><span class="swatch" style="background:${esc(r.cat_color ?? '#ccc')}"></span>${esc(r.cat_name ?? '-')}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${r.n_speakers > 0 ? `<span class="badge badge--on">${r.n_speakers}</span>` : '<span class="badge badge--off">0</span>'}</td>
        <td>${vw ? `<strong>${vw.aantal}</strong> <span class="muted">(${vw.jaar})</span>` : '<span class="muted">-</span>'}</td>
        <td>${r.sort_order}</td>
        <td class="actions">
          ${r.n_speakers === 0 ? `<a class="btn btn--primary btn--sm" href="/admin/speakers/new?beroep=${r.id}">+ Voorlichter</a>` : ''}
          <a class="btn btn--ghost btn--sm" href="/admin/beroepen/${r.id}">Bewerken</a>
        </td>
      </tr>`;
    })
    .join('');

  const tab = (key: string, label: string, n: number) =>
    `<a class="btn ${filter === key ? 'btn--primary' : 'btn--ghost'} btn--sm" href="/admin/beroepen${key === 'zonder' ? '?filter=zonder' : ''}">${label} (${n})</a>`;
  const tabs = `${tab('alle', 'Alle beroepen', all.length)} ${tab('zonder', 'Zonder spreker', zonder.length)}`;

  const intro =
    filter === 'zonder'
      ? '<p class="muted">Deze beroepen hebben nog <strong>géén voorlichter</strong>, werf hier gericht. Klik <strong>+ Voorlichter</strong> om meteen een spreker aan dit beroep te koppelen.</p>'
      : '<p class="muted">De kolom <strong>Sprekers</strong> toont hoeveel voorlichters aan een beroep hangen. Filter op <strong>Zonder spreker</strong> om te zien waar nog geworven moet worden. <strong>Leerlingen</strong> is het laatst bekende aantal leerlingen bij dit beroep (met het jaar); de sessie-indeling kiest daarop een passend lokaal.</p>';

  const empty =
    filter === 'zonder'
      ? emptyState({ colspan: 6, title: '🎉 Elk beroep heeft minstens één voorlichter, niets meer te werven.' })
      : emptyState({ colspan: 6, title: 'Nog geen beroepen.', cta: { href: '/admin/beroepen/new', label: 'Eerste beroep toevoegen' } });

  const headerActions = `${
    filter === 'zonder' && zonder.length
      ? '<a class="btn btn--ghost" href="/admin/beroepen/zonder-spreker.pdf">⬇ Werflijst (PDF)</a> '
      : ''
  }<a class="btn btn--ghost" href="/admin/beroepen/aantallen">Leerlingenaantallen invoeren</a> <a class="btn btn--primary" href="/admin/beroepen/new">Nieuw beroep</a>`;
  const body = `
    ${pageHeader('Beroepen', headerActions)}
    <div class="list-toolbar" style="margin-bottom:8px">${tabs}</div>
    ${intro}
    ${filterBar({ targetId: 'tbl-beroepen', placeholder: 'Zoek op beroep of categorie…', total: showing.length, noun: 'beroepen' })}
    <div class="table-wrap"><table class="data" id="tbl-beroepen">
      <thead><tr><th>Categorie</th><th>Beroep</th><th>Sprekers</th><th>Leerlingen</th><th>#</th><th></th></tr></thead>
      <tbody>${list ? list + filterEmptyRow(6) : empty}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Beroepen', activeKey: 'beroepen', body, flash: flashFromQuery(c) });
});

/**
 * Bulk-invoer leerlingenaantallen: alle beroepen onder elkaar met per beroep een
 * invulveld voor één jaar (kiesbaar; standaard vorig jaar, want daar komt de
 * statistiek van een eerdere editie vandaan). Vóór '/:id', anders vangt die
 * route 'aantallen' op.
 */
beroepenApp.get('/aantallen', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  const actiefJaar = ev?.year ?? new Date().getUTCFullYear();
  const jaarParam = parseInt(c.req.query('jaar') ?? '', 10);
  const jaar = Number.isFinite(jaarParam) && jaarParam >= 2000 && jaarParam <= 2100 ? jaarParam : actiefJaar - 1;
  const [rows, bezoek] = await Promise.all([
    c.env.DB.prepare(
      `SELECT b.id, b.name, cat.name AS cat_name, cat.color AS cat_color,
              (SELECT COUNT(*) FROM speakers s WHERE s.beroep_id = b.id) AS n_speakers
         FROM beroepen b LEFT JOIN categories cat ON cat.id = b.category_id
        ORDER BY cat.sort_order, b.sort_order, b.name`
    ).all<{ id: number; name: string; cat_name: string | null; cat_color: string | null; n_speakers: number }>(),
    loadBezoek(c.env.DB),
  ]);
  const all = rows.results ?? [];
  const jaren = bezoekJaren(actiefJaar, [...bezoek.values()].flat());
  let ingevuld = 0;
  const list = all
    .map((r) => {
      const rijen = bezoek.get(r.id) ?? [];
      const dit = rijen.find((x) => x.jaar === jaar);
      if (dit) ingevuld++;
      const overige = rijen.filter((x) => x.jaar !== jaar).map((x) => `${x.jaar}: ${x.aantal}`).join(' · ');
      return `<tr>
        <td><span class="swatch" style="background:${esc(r.cat_color ?? '#ccc')}"></span>${esc(r.cat_name ?? '-')}</td>
        <td><strong>${esc(r.name)}</strong>${r.n_speakers ? '' : ' <span class="badge badge--off" title="Nog geen voorlichter gekoppeld">geen voorlichter</span>'}</td>
        <td><input class="fld__input" type="number" min="0" max="2000" inputmode="numeric" name="n_${r.id}" value="${dit ? dit.aantal : ''}" aria-label="Aantal leerlingen ${esc(r.name)} in ${jaar}" style="max-width:110px"></td>
        <td>${dit ? bronBadge(dit.bron) : '<span class="muted">-</span>'}</td>
        <td class="muted">${esc(overige) || '-'}</td>
      </tr>`;
    })
    .join('');
  const jaarOpties = jaren.map((j) => `<option value="${j}"${j === jaar ? ' selected' : ''}>${j}${j === actiefJaar ? ' (deze editie)' : ''}</option>`).join('');
  const body = `
    ${backLink('/admin/beroepen', 'Terug naar beroepen')}
    ${pageHeader(`Leerlingenaantallen per beroep · ${jaar}`)}
    <p class="muted">Vul per beroep in hoeveel leerlingen er in <strong>${jaar}</strong> op af kwamen. De sessie-indeling gebruikt per beroep het laatst bekende jaar: grote beroepen krijgen een groot lokaal en drukke beroepen worden over de tijdvakken gespreid. Leeg laten = onbekend. Het aantal van de avond zelf (${actiefJaar}) vullen de voorlichters straks via hun evaluatie automatisch in; wat je hier invult gaat vóór.</p>
    <form method="get" action="/admin/beroepen/aantallen" class="list-toolbar" style="margin-bottom:8px">
      <label class="fld" style="max-width:260px"><span class="fld__label">Jaar</span>
        <select class="fld__input" name="jaar">${jaarOpties}</select></label>
      <button type="submit" class="btn btn--ghost btn--sm" style="align-self:end">Toon jaar</button>
    </form>
    ${filterBar({ targetId: 'tbl-aantallen', placeholder: 'Zoek op beroep of categorie…', total: all.length, noun: 'beroepen' })}
    <p class="muted" role="status">${ingevuld} van ${all.length} beroepen hebben een aantal voor ${jaar}.</p>
    <form method="post" action="/admin/beroepen/aantallen" data-no-busy>
      <input type="hidden" name="jaar" value="${jaar}">
      <div class="table-wrap"><table class="data" id="tbl-aantallen">
        <thead><tr><th>Categorie</th><th>Beroep</th><th>Leerlingen ${jaar}</th><th>Bron</th><th>Andere jaren</th></tr></thead>
        <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen beroepen.</td></tr>'}${filterEmptyRow(5)}</tbody>
      </table></div>
      <div class="form-actions form-actions--sticky">
        <button type="submit" class="btn btn--primary">Opslaan</button>
        <a class="btn btn--ghost" href="/admin/beroepen">Annuleren</a>
      </div>
    </form>`;
  return renderAdminLayout(c, { title: 'Leerlingenaantallen', activeKey: 'beroepen', body, flash: flashFromQuery(c) });
});

beroepenApp.post('/aantallen', async (c) => {
  const b = await c.req.parseBody();
  const jaar = parseInt(str(b.jaar), 10);
  if (!Number.isFinite(jaar) || jaar < 2000 || jaar > 2100) return redirectErr(c, '/admin/beroepen/aantallen', 'Ongeldig jaar.');
  const waarden = new Map<number, string>();
  for (const [k, v] of Object.entries(b)) {
    if (!k.startsWith('n_')) continue;
    const id = parseInt(k.slice(2), 10);
    if (Number.isFinite(id)) waarden.set(id, typeof v === 'string' ? v.trim() : '');
  }
  const n = await saveBezoekJaar(c.env.DB, jaar, waarden);
  await logAudit(c, 'update', 'beroep_bezoek', String(jaar), { gewijzigd: n });
  return redirectOk(c, `/admin/beroepen/aantallen?jaar=${jaar}`, n ? `Leerlingenaantallen ${jaar} opgeslagen (${n} gewijzigd).` : `Niets gewijzigd voor ${jaar}.`);
});

// Werflijst-export: beroepen zonder gekoppelde voorlichter (CSV, Excel-proof).
beroepenApp.get('/zonder-spreker.csv', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT b.name AS beroep, cat.name AS categorie
       FROM beroepen b LEFT JOIN categories cat ON cat.id = b.category_id
      WHERE NOT EXISTS (SELECT 1 FROM speakers s WHERE s.beroep_id = b.id)
      ORDER BY cat.sort_order, b.sort_order, b.name`
  ).all<{ beroep: string; categorie: string | null }>();
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv =
    '﻿' +
    ['categorie,beroep,status']
      .concat((rows.results ?? []).map((r) => [q(r.categorie ?? ''), q(r.beroep), q('zoekt voorlichter')].join(',')))
      .join('\r\n');
  await logAudit(c, 'export', 'beroepen_zonder_spreker', undefined, { count: (rows.results ?? []).length });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="beroepen-zonder-voorlichter.csv"',
    },
  });
});

// Werflijst-export als PDF met Rotary-logo (deelbaar/afdrukbaar).
beroepenApp.get('/zonder-spreker.pdf', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT b.name AS beroep, cat.name AS categorie, cat.color AS color
       FROM beroepen b LEFT JOIN categories cat ON cat.id = b.category_id
      WHERE NOT EXISTS (SELECT 1 FROM speakers s WHERE s.beroep_id = b.id)
      ORDER BY cat.sort_order, b.sort_order, b.name`
  ).all<{ beroep: string; categorie: string | null; color: string | null }>();
  const logoRes = await c.env.ASSETS.fetch(new Request(new URL('/assets/img/rotary-logo.png', c.req.url)));
  const logo = new Uint8Array(await logoRes.arrayBuffer());
  const d = new Date();
  const dateLabel = `${d.getUTCDate()} ${MAAND[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const bytes = await buildWerflijstPdf({
    logo,
    rows: (rows.results ?? []).map((r) => ({ categorie: r.categorie ?? 'Overig', beroep: r.beroep, color: r.color })),
    dateLabel,
  });
  await logAudit(c, 'export_pdf', 'beroepen_zonder_spreker', undefined, { count: (rows.results ?? []).length });
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="beroepen-zonder-voorlichter.pdf"',
    },
  });
});

async function form(c: any, b: Partial<Beroep>, isNew: boolean): Promise<string> {
  const options = await catOptions(c);
  let bezoekHtml = '';
  if (!isNew && b.id != null) {
    const [ev, bezoek] = await Promise.all([getActiveEvent(c.env.DB), loadBezoek(c.env.DB)]);
    bezoekHtml = bezoekKaart(ev?.year ?? new Date().getUTCFullYear(), bezoek.get(b.id) ?? []);
  }
  return `
    ${backLink('/admin/beroepen', 'Terug naar beroepen')}
    ${pageHeader(isNew ? 'Nieuw beroep' : `Beroep: ${esc(b.name ?? '')}`)}
    <form method="post" action="/admin/beroepen/${isNew ? 'new' : b.id}">
      <div class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Naam', name: 'name', value: b.name ?? '', required: true })}</div>
        ${select({ label: 'Categorie', name: 'category_id', value: b.category_id ?? '', options, empty: '(kies)' })}
        ${field({ label: 'Volgorde', name: 'sort_order', value: b.sort_order ?? 0, type: 'number' })}
        <div class="span-2">${field({ label: 'Slug (URL)', name: 'slug', value: b.slug ?? '', help: 'Deel van de webadres-URL (/beroepen/<slug>). Leeg laten = automatisch uit de naam. Wijzig alleen bewust; oude links blijven werken.' })}</div>
        <div class="span-2">${textarea({ label: 'Omschrijving (markdown, optioneel)', name: 'description_md', value: b.description_md ?? '', rows: 5 })}</div>
      </div>
      </div>
      ${bezoekHtml}
      <div class="card">${formActions('Opslaan', '/admin/beroepen')}</div>
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/beroepen/${b.id}/delete`, 'Beroep verwijderen?')}</div>`}`;
}

beroepenApp.get('/new', async (c) =>
  renderAdminLayout(c, { title: 'Nieuw beroep', activeKey: 'beroepen', body: await form(c, {}, true) })
);

beroepenApp.get('/:id', async (c) => {
  const b = await c.env.DB.prepare('SELECT * FROM beroepen WHERE id = ?').bind(c.req.param('id')).first<Beroep>();
  if (!b) return redirectErr(c, '/admin/beroepen', 'Beroep niet gevonden.');
  // Gekoppelde sprekers tonen.
  const sp = await c.env.DB.prepare(
    'SELECT id, full_name, organization, is_public FROM speakers WHERE beroep_id = ? ORDER BY full_name'
  )
    .bind(b.id)
    .all<{ id: string; full_name: string; organization: string | null; is_public: number }>();
  const speakers = sp.results ?? [];
  const speakerCard = `<div class="card">
    <h2>Gekoppelde sprekers (${speakers.length})</h2>
    ${
      speakers.length
        ? `<ul class="editor-list">${speakers
            .map(
              (s) =>
                `<li><a href="/admin/speakers/${esc(s.id)}">${esc(s.full_name)}</a>${s.organization ? ` <span class="muted">· ${esc(s.organization)}</span>` : ''}${s.is_public ? '' : ' <span class="badge badge--off">verborgen</span>'}</li>`
            )
            .join('')}</ul>`
        : '<p class="muted">Nog geen spreker gekoppeld aan dit beroep, dat mag. Koppel een spreker via <a href="/admin/speakers">Sprekers</a> (kies dit beroep in de treklijst).</p>'
    }
  </div>`;
  return renderAdminLayout(c, { title: 'Beroep bewerken', activeKey: 'beroepen', body: (await form(c, b, false)) + speakerCard });
});

beroepenApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  if (!str(b.category_id)) return redirectErr(c, '/admin/beroepen', 'Kies een categorie.');
  const slug = await uniekeBeroepSlug(c.env.DB, str(b.slug), str(b.name), null);
  const res = await c.env.DB.prepare(
    'INSERT INTO beroepen (category_id, name, slug, sort_order, description_md) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(str(b.category_id), str(b.name), slug, intOr(b.sort_order, 0), strOrNull(b.description_md))
    .run();
  await logAudit(c, 'create', 'beroep', String(res.meta?.last_row_id ?? ''));
  return redirectOk(c, '/admin/beroepen', 'Beroep aangemaakt.');
});

beroepenApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  const slug = await uniekeBeroepSlug(c.env.DB, str(b.slug), str(b.name), parseInt(id, 10));
  await c.env.DB.prepare(
    'UPDATE beroepen SET category_id = ?, name = ?, slug = ?, sort_order = ?, description_md = ? WHERE id = ?'
  )
    .bind(str(b.category_id), str(b.name), slug, intOr(b.sort_order, 0), strOrNull(b.description_md), id)
    .run();
  await saveBezoekVelden(c.env.DB, parseInt(id, 10), b as Record<string, unknown>);
  await logAudit(c, 'update', 'beroep', id);
  return redirectOk(c, '/admin/beroepen', 'Beroep opgeslagen.');
});

beroepenApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM beroepen WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'beroep', id);
  return redirectOk(c, '/admin/beroepen', 'Beroep verwijderd.');
});
