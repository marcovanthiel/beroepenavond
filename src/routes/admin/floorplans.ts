/** Plattegronden per verdieping (achtergrond-afbeelding + viewBox). */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { getActiveEvent } from '../../lib/db';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, intOr, genId, redirectOk, redirectErr } from '../../lib/forms';
import { uploadImage, deleteMedia, r2Available, UploadError } from '../../lib/media';

export const floorplansApp = new Hono<AdminEnv>();

interface Floorplan {
  id: string;
  event_id: string;
  floor_slug: string;
  floor_label: string;
  image_url: string;
  viewbox: string;
  sort_order: number;
}

floorplansApp.get('/', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev)
    return renderAdminLayout(c, {
      title: 'Plattegronden',
      activeKey: 'floorplans',
      body: `${pageHeader('Plattegronden')}<div class="card"><p>Maak eerst een <a href="/admin/events">editie</a> aan.</p></div>`,
    });
  const rows = await c.env.DB.prepare(
    'SELECT * FROM floorplans WHERE event_id = ? ORDER BY sort_order'
  )
    .bind(ev.id)
    .all<Floorplan>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>${r.image_url ? `<img src="${esc(r.image_url)}" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:4px;vertical-align:middle">` : ''}</td>
        <td><strong>${esc(r.floor_label)}</strong><br><span class="muted mono">${esc(r.floor_slug)}</span></td>
        <td class="mono">${esc(r.viewbox)}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/floorplans/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader(`Plattegronden — ${esc(ev.title)}`, '<a class="btn btn--primary" href="/admin/floorplans/new">Nieuwe plattegrond</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Beeld</th><th>Verdieping</th><th>viewBox</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="4" class="empty">Nog geen plattegronden.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Plattegronden', activeKey: 'floorplans', body, flash: flashFromQuery(c) });
});

function form(c: any, r: Partial<Floorplan>, isNew: boolean): string {
  const r2 = r2Available(c.env);
  const preview = r.image_url ? `<div style="margin-bottom:8px"><img src="${esc(r.image_url)}" alt="" style="max-width:320px;border:1px solid #e3e6ea;border-radius:8px"></div>` : '';
  const uploadField = r2
    ? `<label class="fld"><span class="fld__label">Plattegrond-afbeelding uploaden</span>${preview}
        <input class="fld__input" type="file" name="image_file" accept="image/*">
        <span class="fld__help">PNG/JPG/SVG, max 8 MB. Vervangt de huidige afbeelding.</span></label>`
    : `<label class="fld"><span class="fld__label">Afbeelding</span>${preview}
        <span class="fld__help">R2 nog niet gekoppeld — gebruik het URL-veld.</span></label>`;
  return `
    ${pageHeader(isNew ? 'Nieuwe plattegrond' : esc(r.floor_label ?? 'Plattegrond'))}
    <form method="post" action="/admin/floorplans/${isNew ? 'new' : esc(r.id!)}" enctype="multipart/form-data" class="card">
      <div class="form-grid cols-2">
        ${field({ label: 'Verdieping (label)', name: 'floor_label', value: r.floor_label ?? '', required: true })}
        ${field({ label: 'Slug', name: 'floor_slug', value: r.floor_slug ?? '', required: true, help: 'bijv. begane-grond' })}
        ${field({ label: 'viewBox', name: 'viewbox', value: r.viewbox ?? '0 0 1000 600', help: 'SVG-coördinaten: "0 0 breedte hoogte"' })}
        ${field({ label: 'Volgorde', name: 'sort_order', value: r.sort_order ?? 100, type: 'number' })}
        <div class="span-2">${uploadField}</div>
        <div class="span-2">${field({ label: 'Afbeeldings-URL (extern of /media/…)', name: 'image_url', value: r.image_url ?? '' })}</div>
      </div>
      ${formActions('Opslaan', '/admin/floorplans')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/floorplans/${esc(r.id!)}/delete`, 'Plattegrond verwijderen?')}</div>`}`;
}

floorplansApp.get('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/floorplans', 'Geen actieve editie.');
  return renderAdminLayout(c, { title: 'Nieuwe plattegrond', activeKey: 'floorplans', body: form(c, { viewbox: '0 0 1000 600', sort_order: 100 }, true) });
});

floorplansApp.get('/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM floorplans WHERE id = ?').bind(c.req.param('id')).first<Floorplan>();
  if (!r) return redirectErr(c, '/admin/floorplans', 'Plattegrond niet gevonden.');
  return renderAdminLayout(c, { title: 'Plattegrond bewerken', activeKey: 'floorplans', body: form(c, r, false) });
});

async function resolveImage(c: any, body: Record<string, unknown>, current: string | null): Promise<string | null> {
  const file = body.image_file;
  if (file instanceof File && file.size > 0) {
    const url = await uploadImage(c.env, file, 'floorplans');
    if (current && current.startsWith('/media/')) await deleteMedia(c.env, current);
    return url;
  }
  return strOrNull(body.image_url);
}

floorplansApp.post('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/floorplans', 'Geen actieve editie.');
  const b = await c.req.parseBody();
  let image: string | null;
  try {
    image = await resolveImage(c, b, null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, '/admin/floorplans/new', e.message);
    throw e;
  }
  const id = genId('fp');
  await c.env.DB.prepare(
    'INSERT INTO floorplans (id, event_id, floor_slug, floor_label, image_url, viewbox, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, ev.id, str(b.floor_slug), str(b.floor_label), image ?? '', str(b.viewbox) || '0 0 1000 600', intOr(b.sort_order, 100))
    .run();
  await logAudit(c, 'create', 'floorplan', id);
  return redirectOk(c, '/admin/floorplans', 'Plattegrond aangemaakt.');
});

floorplansApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT image_url FROM floorplans WHERE id = ?').bind(id).first<{ image_url: string }>();
  const b = await c.req.parseBody();
  let image: string | null;
  try {
    image = await resolveImage(c, b, cur?.image_url ?? null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, `/admin/floorplans/${id}`, e.message);
    throw e;
  }
  await c.env.DB.prepare(
    'UPDATE floorplans SET floor_slug = ?, floor_label = ?, image_url = ?, viewbox = ?, sort_order = ? WHERE id = ?'
  )
    .bind(str(b.floor_slug), str(b.floor_label), image ?? '', str(b.viewbox) || '0 0 1000 600', intOr(b.sort_order, 100), id)
    .run();
  await logAudit(c, 'update', 'floorplan', id);
  return redirectOk(c, '/admin/floorplans', 'Plattegrond opgeslagen.');
});

floorplansApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT image_url FROM floorplans WHERE id = ?').bind(id).first<{ image_url: string }>();
  if (cur?.image_url) await deleteMedia(c.env, cur.image_url);
  await c.env.DB.prepare('DELETE FROM floorplans WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'floorplan', id);
  return redirectOk(c, '/admin/floorplans', 'Plattegrond verwijderd.');
});
