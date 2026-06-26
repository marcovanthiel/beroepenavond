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
import { str, strOrNull, intOr, redirectOk, redirectErr } from '../../lib/forms';
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

  const list = showing
    .map(
      (r) => `<tr>
        <td><span class="swatch" style="background:${esc(r.cat_color ?? '#ccc')}"></span>${esc(r.cat_name ?? '—')}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${r.n_speakers > 0 ? `<span class="badge badge--on">${r.n_speakers}</span>` : '<span class="badge badge--off">0</span>'}</td>
        <td>${r.sort_order}</td>
        <td class="actions">
          ${r.n_speakers === 0 ? `<a class="btn btn--primary btn--sm" href="/admin/speakers/new?beroep=${r.id}">+ Voorlichter</a>` : ''}
          <a class="btn btn--ghost btn--sm" href="/admin/beroepen/${r.id}">Bewerken</a>
        </td>
      </tr>`
    )
    .join('');

  const tab = (key: string, label: string, n: number) =>
    `<a class="btn ${filter === key ? 'btn--primary' : 'btn--ghost'} btn--sm" href="/admin/beroepen${key === 'zonder' ? '?filter=zonder' : ''}">${label} (${n})</a>`;
  const tabs = `${tab('alle', 'Alle beroepen', all.length)} ${tab('zonder', 'Zonder spreker', zonder.length)}`;

  const intro =
    filter === 'zonder'
      ? '<p class="muted">Deze beroepen hebben nog <strong>géén voorlichter</strong> — werf hier gericht. Klik <strong>+ Voorlichter</strong> om meteen een spreker aan dit beroep te koppelen.</p>'
      : '<p class="muted">De kolom <strong>Sprekers</strong> toont hoeveel voorlichters aan een beroep hangen. Filter op <strong>Zonder spreker</strong> om te zien waar nog geworven moet worden.</p>';

  const empty =
    filter === 'zonder'
      ? emptyState({ colspan: 5, title: '🎉 Elk beroep heeft minstens één voorlichter — niets meer te werven.' })
      : emptyState({ colspan: 5, title: 'Nog geen beroepen.', cta: { href: '/admin/beroepen/new', label: 'Eerste beroep toevoegen' } });

  const headerActions = `${
    filter === 'zonder' && zonder.length
      ? '<a class="btn btn--ghost" href="/admin/beroepen/zonder-spreker.pdf">⬇ Werflijst (PDF)</a> '
      : ''
  }<a class="btn btn--primary" href="/admin/beroepen/new">Nieuw beroep</a>`;
  const body = `
    ${pageHeader('Beroepen', headerActions)}
    <div class="list-toolbar" style="margin-bottom:8px">${tabs}</div>
    ${intro}
    ${filterBar({ targetId: 'tbl-beroepen', placeholder: 'Zoek op beroep of categorie…', total: showing.length, noun: 'beroepen' })}
    <div class="table-wrap"><table class="data" id="tbl-beroepen">
      <thead><tr><th>Categorie</th><th>Beroep</th><th>Sprekers</th><th>#</th><th></th></tr></thead>
      <tbody>${list ? list + filterEmptyRow(5) : empty}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Beroepen', activeKey: 'beroepen', body, flash: flashFromQuery(c) });
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
  return `
    ${backLink('/admin/beroepen', 'Terug naar beroepen')}
    ${pageHeader(isNew ? 'Nieuw beroep' : `Beroep: ${esc(b.name ?? '')}`)}
    <form method="post" action="/admin/beroepen/${isNew ? 'new' : b.id}" class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Naam', name: 'name', value: b.name ?? '', required: true })}</div>
        ${select({ label: 'Categorie', name: 'category_id', value: b.category_id ?? '', options, empty: '— kies —' })}
        ${field({ label: 'Volgorde', name: 'sort_order', value: b.sort_order ?? 0, type: 'number' })}
        <div class="span-2">${field({ label: 'Slug / anker (optioneel)', name: 'slug', value: b.slug ?? '' })}</div>
        <div class="span-2">${textarea({ label: 'Omschrijving (markdown, optioneel)', name: 'description_md', value: b.description_md ?? '', rows: 5 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/beroepen')}
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
        : '<p class="muted">Nog geen spreker gekoppeld aan dit beroep — dat mag. Koppel een spreker via <a href="/admin/speakers">Sprekers</a> (kies dit beroep in de treklijst).</p>'
    }
  </div>`;
  return renderAdminLayout(c, { title: 'Beroep bewerken', activeKey: 'beroepen', body: (await form(c, b, false)) + speakerCard });
});

beroepenApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  if (!str(b.category_id)) return redirectErr(c, '/admin/beroepen', 'Kies een categorie.');
  const res = await c.env.DB.prepare(
    'INSERT INTO beroepen (category_id, name, slug, sort_order, description_md) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(str(b.category_id), str(b.name), strOrNull(b.slug), intOr(b.sort_order, 0), strOrNull(b.description_md))
    .run();
  await logAudit(c, 'create', 'beroep', String(res.meta?.last_row_id ?? ''));
  return redirectOk(c, '/admin/beroepen', 'Beroep aangemaakt.');
});

beroepenApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    'UPDATE beroepen SET category_id = ?, name = ?, slug = ?, sort_order = ?, description_md = ? WHERE id = ?'
  )
    .bind(str(b.category_id), str(b.name), strOrNull(b.slug), intOr(b.sort_order, 0), strOrNull(b.description_md), id)
    .run();
  await logAudit(c, 'update', 'beroep', id);
  return redirectOk(c, '/admin/beroepen', 'Beroep opgeslagen.');
});

beroepenApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM beroepen WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'beroep', id);
  return redirectOk(c, '/admin/beroepen', 'Beroep verwijderd.');
});
