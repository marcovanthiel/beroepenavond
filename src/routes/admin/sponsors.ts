/** Sponsoren — meerdere, met logo (R2-upload of URL) en link. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  checkbox,
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, bool, intOr, genId, redirectOk, redirectErr } from '../../lib/forms';
import { uploadImage, deleteMedia, r2Available, UploadError } from '../../lib/media';

export const sponsorsApp = new Hono<AdminEnv>();

interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  sort_order: number;
  is_active: number;
}

sponsorsApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM sponsors ORDER BY sort_order, name').all<Sponsor>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>${r.logo_url ? `<img src="${esc(r.logo_url)}" alt="" style="height:34px;width:auto;vertical-align:middle">` : ''}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${r.is_active ? '<span class="badge badge--on">Actief</span>' : '<span class="badge badge--off">Verborgen</span>'}</td>
        <td>${r.sort_order}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/sponsors/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Sponsoren', '<a class="btn btn--primary" href="/admin/sponsors/new">Nieuwe sponsor</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Logo</th><th>Naam</th><th>Status</th><th>#</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen sponsoren.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Sponsoren', activeKey: 'sponsors', body, flash: flashFromQuery(c) });
});

function form(c: any, s: Partial<Sponsor>, isNew: boolean): string {
  const r2 = r2Available(c.env);
  const preview = s.logo_url ? `<div style="margin-bottom:8px"><img src="${esc(s.logo_url)}" alt="" style="max-height:60px;background:#eee;padding:6px;border-radius:6px"></div>` : '';
  const upload = r2
    ? `<label class="fld"><span class="fld__label">Logo uploaden</span>${preview}<input class="fld__input" type="file" name="logo_file" accept="image/*"><span class="fld__help">PNG/SVG met transparante achtergrond werkt het mooist.</span></label>`
    : `<label class="fld"><span class="fld__label">Logo</span>${preview}<span class="fld__help">R2 niet gekoppeld — gebruik de URL hieronder.</span></label>`;
  return `
    ${pageHeader(isNew ? 'Nieuwe sponsor' : esc(s.name ?? 'Sponsor'))}
    <form method="post" action="/admin/sponsors/${isNew ? 'new' : esc(s.id!)}" enctype="multipart/form-data" class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Naam', name: 'name', value: s.name ?? '', required: true })}</div>
        <div class="span-2">${field({ label: 'Website (URL)', name: 'website', value: s.website ?? '', type: 'url' })}</div>
        <div class="span-2">${upload}</div>
        <div class="span-2">${field({ label: 'Logo-URL (extern of /media/…)', name: 'logo_url', value: s.logo_url ?? '' })}</div>
        ${field({ label: 'Volgorde', name: 'sort_order', value: s.sort_order ?? 100, type: 'number' })}
        <div style="display:flex;align-items:flex-end">${checkbox({ label: 'Actief (tonen op de site)', name: 'is_active', checked: s.is_active !== 0 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/sponsors')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/sponsors/${esc(s.id!)}/delete`, 'Sponsor verwijderen?')}</div>`}`;
}

sponsorsApp.get('/new', (c) =>
  renderAdminLayout(c, { title: 'Nieuwe sponsor', activeKey: 'sponsors', body: form(c, { is_active: 1, sort_order: 100 }, true) })
);

sponsorsApp.get('/:id', async (c) => {
  const s = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?').bind(c.req.param('id')).first<Sponsor>();
  if (!s) return redirectErr(c, '/admin/sponsors', 'Sponsor niet gevonden.');
  return renderAdminLayout(c, { title: 'Sponsor bewerken', activeKey: 'sponsors', body: form(c, s, false) });
});

async function resolveLogo(c: any, b: Record<string, unknown>, current: string | null): Promise<string | null> {
  const file = b.logo_file;
  if (file instanceof File && file.size > 0) {
    const url = await uploadImage(c.env, file, 'sponsors');
    if (current && current.startsWith('/media/')) await deleteMedia(c.env, current);
    return url;
  }
  return strOrNull(b.logo_url);
}

sponsorsApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  if (!str(b.name)) return redirectErr(c, '/admin/sponsors/new', 'Naam is verplicht.');
  let logo: string | null;
  try {
    logo = await resolveLogo(c, b, null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, '/admin/sponsors/new', e.message);
    throw e;
  }
  const id = genId('spn');
  await c.env.DB.prepare(
    'INSERT INTO sponsors (id, name, logo_url, website, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, str(b.name), logo, strOrNull(b.website), intOr(b.sort_order, 100), bool(b.is_active))
    .run();
  await logAudit(c, 'create', 'sponsor', id);
  return redirectOk(c, '/admin/sponsors', 'Sponsor aangemaakt.');
});

sponsorsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT logo_url FROM sponsors WHERE id = ?').bind(id).first<{ logo_url: string | null }>();
  const b = await c.req.parseBody();
  let logo: string | null;
  try {
    logo = await resolveLogo(c, b, cur?.logo_url ?? null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, `/admin/sponsors/${id}`, e.message);
    throw e;
  }
  await c.env.DB.prepare(
    'UPDATE sponsors SET name = ?, logo_url = ?, website = ?, sort_order = ?, is_active = ? WHERE id = ?'
  )
    .bind(str(b.name), logo, strOrNull(b.website), intOr(b.sort_order, 100), bool(b.is_active), id)
    .run();
  await logAudit(c, 'update', 'sponsor', id);
  return redirectOk(c, '/admin/sponsors', 'Sponsor opgeslagen.');
});

sponsorsApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT logo_url FROM sponsors WHERE id = ?').bind(id).first<{ logo_url: string | null }>();
  if (cur?.logo_url) await deleteMedia(c.env, cur.logo_url);
  await c.env.DB.prepare('DELETE FROM sponsors WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'sponsor', id);
  return redirectOk(c, '/admin/sponsors', 'Sponsor verwijderd.');
});
