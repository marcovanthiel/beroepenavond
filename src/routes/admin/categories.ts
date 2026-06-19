/** Beroepscategorieën — naam, kleur (legenda/plattegrond), volgorde. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  textarea,
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, intOr, genId, redirectOk, redirectErr } from '../../lib/forms';

export const categoriesApp = new Hono<AdminEnv>();

interface Cat {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
}

categoriesApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM categories ORDER BY sort_order'
  ).all<Cat>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>${r.sort_order}</td>
        <td><span class="swatch" style="background:${esc(r.color ?? '#ccc')}"></span>${esc(r.name)}</td>
        <td class="muted mono">${esc(r.id)}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/categories/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Categorieën', '<a class="btn btn--primary" href="/admin/categories/new">Nieuwe categorie</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>#</th><th>Naam</th><th>ID</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="4" class="empty">Nog geen categorieën.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Categorieën', activeKey: 'categories', body, flash: flashFromQuery(c) });
});

function form(cat: Partial<Cat>, isNew: boolean): string {
  return `
    ${pageHeader(isNew ? 'Nieuwe categorie' : 'Categorie bewerken')}
    <form method="post" action="/admin/categories/${isNew ? 'new' : esc(cat.id!)}" class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Naam', name: 'name', value: cat.name, required: true })}</div>
        ${field({ label: 'Kleur (hex)', name: 'color', value: cat.color ?? '#88bc1d', type: 'color' })}
        ${field({ label: 'Volgorde', name: 'sort_order', value: cat.sort_order ?? 100, type: 'number' })}
        <div class="span-2">${textarea({ label: 'Omschrijving (optioneel)', name: 'description', value: cat.description ?? '', rows: 3 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/categories')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/categories/${esc(cat.id!)}/delete`, 'Categorie en alle gekoppelde beroepen verwijderen?')}</div>`}`;
}

categoriesApp.get('/new', (c) =>
  renderAdminLayout(c, { title: 'Nieuwe categorie', activeKey: 'categories', body: form({}, true) })
);

categoriesApp.get('/:id', async (c) => {
  const cat = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(c.req.param('id'))
    .first<Cat>();
  if (!cat) return redirectErr(c, '/admin/categories', 'Categorie niet gevonden.');
  return renderAdminLayout(c, { title: 'Categorie bewerken', activeKey: 'categories', body: form(cat, false) });
});

categoriesApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  const id = genId('cat');
  await c.env.DB.prepare(
    'INSERT INTO categories (id, name, description, color, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, str(b.name), strOrNull(b.description), strOrNull(b.color), intOr(b.sort_order, 100))
    .run();
  await logAudit(c, 'create', 'category', id);
  return redirectOk(c, '/admin/categories', 'Categorie aangemaakt.');
});

categoriesApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    'UPDATE categories SET name = ?, description = ?, color = ?, sort_order = ? WHERE id = ?'
  )
    .bind(str(b.name), strOrNull(b.description), strOrNull(b.color), intOr(b.sort_order, 100), id)
    .run();
  await logAudit(c, 'update', 'category', id);
  return redirectOk(c, '/admin/categories', 'Categorie opgeslagen.');
});

categoriesApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'category', id);
  return redirectOk(c, '/admin/categories', 'Categorie verwijderd.');
});
