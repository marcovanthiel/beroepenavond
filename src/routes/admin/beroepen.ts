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
} from '../../views/admin/layout';
import { str, strOrNull, intOr, redirectOk, redirectErr } from '../../lib/forms';

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
  const rows = await c.env.DB.prepare(
    `SELECT b.*, cat.name AS cat_name, cat.color AS cat_color, cat.sort_order AS cat_order
       FROM beroepen b LEFT JOIN categories cat ON cat.id = b.category_id
      ORDER BY cat.sort_order, b.sort_order`
  ).all<Beroep & { cat_name: string; cat_color: string; cat_order: number }>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td><span class="swatch" style="background:${esc(r.cat_color ?? '#ccc')}"></span>${esc(r.cat_name ?? '—')}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${r.sort_order}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/beroepen/${r.id}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Beroepen', '<a class="btn btn--primary" href="/admin/beroepen/new">Nieuw beroep</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Categorie</th><th>Beroep</th><th>#</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="4" class="empty">Nog geen beroepen.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Beroepen', activeKey: 'beroepen', body, flash: flashFromQuery(c) });
});

async function form(c: any, b: Partial<Beroep>, isNew: boolean): Promise<string> {
  const options = await catOptions(c);
  return `
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
  return renderAdminLayout(c, { title: 'Beroep bewerken', activeKey: 'beroepen', body: await form(c, b, false) });
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
