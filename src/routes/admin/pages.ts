/** Publieke pagina's (slug = PK). Bewerkbare teksten met markdown. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import type { PageRow } from '../../env';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  textarea,
  checkbox,
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, bool, intOr, redirectOk, redirectErr } from '../../lib/forms';

export const pagesApp = new Hono<AdminEnv>();

pagesApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT slug, title, nav_label, nav_order, is_published FROM pages ORDER BY nav_order'
  ).all<PageRow>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>${r.nav_order}</td>
        <td><strong>${esc(r.title)}</strong><br><span class="muted mono">${esc(r.slug)}</span></td>
        <td>${esc(r.nav_label ?? '')}</td>
        <td>${r.is_published ? '<span class="badge badge--on">Live</span>' : '<span class="badge badge--off">Concept</span>'}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/pages/edit?slug=${encodeURIComponent(r.slug)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader("Pagina's", '<a class="btn btn--primary" href="/admin/pages/new">Nieuwe pagina</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>#</th><th>Pagina</th><th>Menu-label</th><th>Status</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen pagina\'s.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: "Pagina's", activeKey: 'pages', body, flash: flashFromQuery(c) });
});

function form(p: Partial<PageRow>, isNew: boolean): string {
  const action = isNew ? '/admin/pages/new' : `/admin/pages/edit?slug=${encodeURIComponent(p.slug!)}`;
  return `
    ${pageHeader(isNew ? 'Nieuwe pagina' : `Pagina: ${esc(p.title ?? '')}`)}
    <form method="post" action="${action}" class="card">
      <div class="form-grid cols-2">
        ${field({ label: 'Slug (bijv. /tijdschema)', name: 'slug', value: p.slug, required: true, help: isNew ? 'Met / ervoor. Niet meer te wijzigen na aanmaken.' : 'Niet wijzigen — dit is de URL.' })}
        ${field({ label: 'Titel', name: 'title', value: p.title, required: true })}
        ${field({ label: 'Menu-label (optioneel)', name: 'nav_label', value: p.nav_label ?? '' })}
        ${field({ label: 'Menu-volgorde', name: 'nav_order', value: p.nav_order ?? 100, type: 'number' })}
        <div class="span-2">${field({ label: 'Meta-omschrijving (SEO)', name: 'meta_description', value: p.meta_description ?? '' })}</div>
        ${field({ label: 'Hero — eyebrow', name: 'hero_eyebrow', value: p.hero_eyebrow ?? '' })}
        ${field({ label: 'Hero — titel', name: 'hero_title', value: p.hero_title ?? '' })}
        <div class="span-2">${field({ label: 'Hero — lede', name: 'hero_lede', value: p.hero_lede ?? '' })}</div>
        <div class="span-2">${field({ label: 'Hero — afbeelding (URL)', name: 'hero_image', value: p.hero_image ?? '' })}</div>
        <div class="span-2">${textarea({ label: 'Inhoud (markdown)', name: 'body_md', value: p.body_md ?? '', rows: 16, mono: true, help: 'Ondersteunt ## koppen, lijsten, tabellen, **vet**, [links](/x). {{sleutel}} = instelling.' })}</div>
        <div class="span-2">${checkbox({ label: 'Gepubliceerd (zichtbaar op site)', name: 'is_published', checked: p.is_published !== 0 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/pages')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/pages/delete?slug=${encodeURIComponent(p.slug!)}`, 'Pagina verwijderen?')}</div>`}`;
}

pagesApp.get('/new', (c) =>
  renderAdminLayout(c, { title: 'Nieuwe pagina', activeKey: 'pages', body: form({ is_published: 1, nav_order: 100 }, true) })
);

pagesApp.get('/edit', async (c) => {
  const slug = c.req.query('slug') ?? '';
  const p = await c.env.DB.prepare('SELECT * FROM pages WHERE slug = ?').bind(slug).first<PageRow>();
  if (!p) return redirectErr(c, '/admin/pages', 'Pagina niet gevonden.');
  return renderAdminLayout(c, { title: 'Pagina bewerken', activeKey: 'pages', body: form(p, false) });
});

function bind(b: Record<string, unknown>) {
  return [
    str(b.title),
    strOrNull(b.meta_description),
    strOrNull(b.hero_eyebrow),
    strOrNull(b.hero_title),
    strOrNull(b.hero_lede),
    strOrNull(b.hero_image),
    str(b.body_md),
    intOr(b.nav_order, 100),
    strOrNull(b.nav_label),
    bool(b.is_published),
  ];
}

pagesApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  let slug = str(b.slug);
  if (!slug.startsWith('/')) slug = '/' + slug;
  if (!slug || slug === '/') return redirectErr(c, '/admin/pages', 'Ongeldige slug.');
  const exists = await c.env.DB.prepare('SELECT 1 FROM pages WHERE slug = ?').bind(slug).first();
  if (exists) return redirectErr(c, '/admin/pages', 'Slug bestaat al.');
  await c.env.DB.prepare(
    `INSERT INTO pages (slug, title, meta_description, hero_eyebrow, hero_title, hero_lede, hero_image, body_md, nav_order, nav_label, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(slug, ...bind(b))
    .run();
  await logAudit(c, 'create', 'page', slug);
  return redirectOk(c, '/admin/pages', 'Pagina aangemaakt.');
});

pagesApp.post('/edit', async (c) => {
  const slug = c.req.query('slug') ?? '';
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    `UPDATE pages SET title = ?, meta_description = ?, hero_eyebrow = ?, hero_title = ?, hero_lede = ?, hero_image = ?, body_md = ?, nav_order = ?, nav_label = ?, is_published = ?, updated_at = unixepoch() WHERE slug = ?`
  )
    .bind(...bind(b), slug)
    .run();
  await logAudit(c, 'update', 'page', slug);
  return redirectOk(c, '/admin/pages', 'Pagina opgeslagen.');
});

pagesApp.post('/delete', async (c) => {
  const slug = c.req.query('slug') ?? '';
  await c.env.DB.prepare('DELETE FROM pages WHERE slug = ?').bind(slug).run();
  await logAudit(c, 'delete', 'page', slug);
  return redirectOk(c, '/admin/pages', 'Pagina verwijderd.');
});
