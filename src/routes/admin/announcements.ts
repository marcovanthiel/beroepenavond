/** Nieuws / aankondigingen — CRUD met optionele cover (R2). */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
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
import { str, strOrNull, bool, genId, redirectOk, redirectErr } from '../../lib/forms';
import { uploadImage, deleteMedia, r2Available, UploadError } from '../../lib/media';

export const announcementsApp = new Hono<AdminEnv>();

interface News {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_md: string;
  cover_url: string | null;
  is_published: number;
  published_at: number;
}

const toDateInput = (u: number) => new Date(u * 1000).toISOString().slice(0, 10);
const fromDateInput = (s: string) => {
  const t = Date.parse(s + 'T12:00:00Z');
  return Number.isFinite(t) ? Math.floor(t / 1000) : Math.floor(Date.now() / 1000);
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

announcementsApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM announcements ORDER BY published_at DESC').all<News>();
  const list = (rows.results ?? [])
    .map(
      (n) => `<tr>
        <td><strong>${esc(n.title)}</strong><br><span class="muted mono">/nieuws/${esc(n.slug)}</span></td>
        <td>${new Date(n.published_at * 1000).toLocaleDateString('nl-NL')}</td>
        <td>${n.is_published ? '<span class="badge badge--on">Live</span>' : '<span class="badge badge--off">Concept</span>'}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/nieuws/${esc(n.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Nieuws', '<a class="btn btn--primary" href="/admin/nieuws/new">Nieuw bericht</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Titel</th><th>Datum</th><th>Status</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="4" class="empty">Nog geen nieuws.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Nieuws', activeKey: 'announcements', body, flash: flashFromQuery(c) });
});

function form(c: any, n: Partial<News>, isNew: boolean): string {
  const r2 = r2Available(c.env);
  const preview = n.cover_url ? `<div style="margin-bottom:8px"><img src="${esc(n.cover_url)}" alt="" style="max-width:280px;border-radius:8px"></div>` : '';
  const upload = r2
    ? `<label class="fld"><span class="fld__label">Cover uploaden</span>${preview}<input class="fld__input" type="file" name="cover_file" accept="image/*"></label>`
    : `<label class="fld"><span class="fld__label">Cover</span>${preview}<span class="fld__help">R2 nog niet gekoppeld — gebruik URL-veld.</span></label>`;
  return `
    ${pageHeader(isNew ? 'Nieuw bericht' : esc(n.title ?? 'Bericht'))}
    <form method="post" action="/admin/nieuws/${isNew ? 'new' : esc(n.id!)}" enctype="multipart/form-data" class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Titel', name: 'title', value: n.title ?? '', required: true })}</div>
        ${field({ label: 'Slug (leeg = automatisch)', name: 'slug', value: n.slug ?? '' })}
        ${field({ label: 'Publicatiedatum', name: 'published_at', value: n.published_at ? toDateInput(n.published_at) : '', type: 'date' })}
        <div class="span-2">${field({ label: 'Samenvatting', name: 'summary', value: n.summary ?? '' })}</div>
        <div class="span-2">${upload}</div>
        <div class="span-2">${field({ label: 'Cover-URL (extern of /media/…)', name: 'cover_url', value: n.cover_url ?? '' })}</div>
        <div class="span-2">${textarea({ label: 'Inhoud (markdown)', name: 'body_md', value: n.body_md ?? '', rows: 12, mono: true })}</div>
        <div class="span-2">${checkbox({ label: 'Gepubliceerd', name: 'is_published', checked: n.is_published !== 0 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/nieuws')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/nieuws/${esc(n.id!)}/delete`, 'Bericht verwijderen?')}</div>`}`;
}

announcementsApp.get('/new', (c) =>
  renderAdminLayout(c, { title: 'Nieuw bericht', activeKey: 'announcements', body: form(c, { is_published: 1, published_at: Math.floor(Date.now() / 1000) }, true) })
);

announcementsApp.get('/:id', async (c) => {
  const n = await c.env.DB.prepare('SELECT * FROM announcements WHERE id = ?').bind(c.req.param('id')).first<News>();
  if (!n) return redirectErr(c, '/admin/nieuws', 'Bericht niet gevonden.');
  return renderAdminLayout(c, { title: 'Bericht bewerken', activeKey: 'announcements', body: form(c, n, false) });
});

async function resolveCover(c: any, b: Record<string, unknown>, current: string | null): Promise<string | null> {
  const file = b.cover_file;
  if (file instanceof File && file.size > 0) {
    const url = await uploadImage(c.env, file, 'nieuws');
    if (current && current.startsWith('/media/')) await deleteMedia(c.env, current);
    return url;
  }
  return strOrNull(b.cover_url);
}

announcementsApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  const title = str(b.title);
  if (!title) return redirectErr(c, '/admin/nieuws/new', 'Titel is verplicht.');
  let cover: string | null;
  try {
    cover = await resolveCover(c, b, null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, '/admin/nieuws/new', e.message);
    throw e;
  }
  const slug = str(b.slug) ? slugify(str(b.slug)) : slugify(title);
  const id = genId('news');
  await c.env.DB.prepare(
    'INSERT INTO announcements (id, slug, title, summary, body_md, cover_url, is_published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, slug, title, strOrNull(b.summary), str(b.body_md), cover, bool(b.is_published), str(b.published_at) ? fromDateInput(str(b.published_at)) : Math.floor(Date.now() / 1000))
    .run();
  await logAudit(c, 'create', 'announcement', id);
  return redirectOk(c, '/admin/nieuws', 'Bericht aangemaakt.');
});

announcementsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT cover_url FROM announcements WHERE id = ?').bind(id).first<{ cover_url: string | null }>();
  const b = await c.req.parseBody();
  let cover: string | null;
  try {
    cover = await resolveCover(c, b, cur?.cover_url ?? null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, `/admin/nieuws/${id}`, e.message);
    throw e;
  }
  await c.env.DB.prepare(
    'UPDATE announcements SET slug = ?, title = ?, summary = ?, body_md = ?, cover_url = ?, is_published = ?, published_at = ?, updated_at = unixepoch() WHERE id = ?'
  )
    .bind(slugify(str(b.slug) || str(b.title)), str(b.title), strOrNull(b.summary), str(b.body_md), cover, bool(b.is_published), fromDateInput(str(b.published_at)), id)
    .run();
  await logAudit(c, 'update', 'announcement', id);
  return redirectOk(c, '/admin/nieuws', 'Bericht opgeslagen.');
});

announcementsApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT cover_url FROM announcements WHERE id = ?').bind(id).first<{ cover_url: string | null }>();
  if (cur?.cover_url) await deleteMedia(c.env, cur.cover_url);
  await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'announcement', id);
  return redirectOk(c, '/admin/nieuws', 'Bericht verwijderd.');
});
