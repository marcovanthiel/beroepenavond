/** Sprekers / voorlichters, met optionele portretfoto (R2-upload). */
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
  checkbox,
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, bool, intOrNull, redirectOk, redirectErr } from '../../lib/forms';
import { uploadImage, deleteMedia, r2Available, UploadError } from '../../lib/media';

export const speakersApp = new Hono<AdminEnv>();

interface Speaker {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  job_title: string | null;
  bio_md: string | null;
  portrait_url: string | null;
  website: string | null;
  linkedin: string | null;
  category_id: string | null;
  beroep_id: number | null;
  is_public: number;
  notes: string | null;
}

speakersApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM speakers ORDER BY full_name'
  ).all<Speaker>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>${r.portrait_url ? `<img src="${esc(r.portrait_url)}" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px">` : ''}<strong>${esc(r.full_name)}</strong></td>
        <td>${esc(r.job_title ?? '')}${r.organization ? ` · ${esc(r.organization)}` : ''}</td>
        <td>${r.is_public ? '<span class="badge badge--on">Publiek</span>' : '<span class="badge badge--off">Verborgen</span>'}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/speakers/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Sprekers', '<a class="btn btn--primary" href="/admin/speakers/new">Nieuwe spreker</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Naam</th><th>Functie</th><th>Zichtbaar</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="4" class="empty">Nog geen sprekers.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Sprekers', activeKey: 'speakers', body, flash: flashFromQuery(c) });
});

async function form(c: any, s: Partial<Speaker>, isNew: boolean): Promise<string> {
  const r2 = r2Available(c.env);
  const cats = await c.env.DB.prepare('SELECT id, name FROM categories ORDER BY sort_order').all();
  const catOptions = (cats.results ?? []).map((x: any) => ({ value: x.id, label: x.name }));
  // Beroep-treklijst, gegroepeerd per categorie (optgroups).
  const ber = await c.env.DB.prepare(
    `SELECT b.id, b.name, c.name AS cat_name, c.sort_order AS cat_order
       FROM beroepen b LEFT JOIN categories c ON c.id = b.category_id
      ORDER BY c.sort_order, b.name`
  ).all();
  const groups = new Map<string, any[]>();
  for (const r of (ber.results ?? []) as any[]) {
    const g = r.cat_name ?? 'Overig';
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(r);
  }
  const curBer = String(s.beroep_id ?? '');
  const beroepSelect = `<label class="fld">
    <span class="fld__label">Beroep</span>
    <select class="fld__input" name="beroep_id">
      <option value="">— nog geen beroep —</option>
      ${[...groups]
        .map(
          ([g, items]) =>
            `<optgroup label="${esc(g)}">${items
              .map(
                (it) =>
                  `<option value="${it.id}" ${String(it.id) === curBer ? 'selected' : ''}>${esc(it.name)}</option>`
              )
              .join('')}</optgroup>`
        )
        .join('')}
    </select>
    <span class="fld__help">Categorie volgt automatisch uit het beroep. <a href="/admin/beroepen/new" target="_blank">Nieuw beroep ↗</a></span>
  </label>`;
  const portrait = s.portrait_url
    ? `<div style="margin-bottom:8px"><img src="${esc(s.portrait_url)}" alt="" style="width:90px;height:90px;border-radius:10px;object-fit:cover"></div>`
    : '';
  const uploadField = r2
    ? `<label class="fld"><span class="fld__label">Portretfoto uploaden</span>
        ${portrait}<input class="fld__input" type="file" name="portrait_file" accept="image/*">
        <span class="fld__help">JPG/PNG/WEBP, max 8 MB. Vervangt de huidige foto.</span></label>`
    : `<label class="fld"><span class="fld__label">Portretfoto</span>${portrait}
        <span class="fld__help">R2-bucket nog niet gekoppeld — gebruik het URL-veld hieronder.</span></label>`;
  return `
    ${pageHeader(isNew ? 'Nieuwe spreker' : esc(s.full_name ?? 'Spreker'))}
    <form method="post" action="/admin/speakers/${isNew ? 'new' : esc(s.id!)}" enctype="multipart/form-data" class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Volledige naam', name: 'full_name', value: s.full_name ?? '', required: true })}</div>
        <div class="span-2">${beroepSelect}</div>
        ${field({ label: 'Functietitel (optioneel)', name: 'job_title', value: s.job_title ?? '', help: 'Specifieke titel op de kaart; leeg = de beroepsnaam' })}
        ${select({ label: 'Categorie', name: 'category_id', value: s.category_id ?? '', options: catOptions, empty: '— geen —', help: 'Wordt overschreven door het gekozen beroep' })}
        ${field({ label: 'Organisatie / werkgever', name: 'organization', value: s.organization ?? '' })}
        ${field({ label: 'E-mail', name: 'email', value: s.email ?? '', type: 'email' })}
        ${field({ label: 'Telefoon', name: 'phone', value: s.phone ?? '' })}
        ${field({ label: 'Website', name: 'website', value: s.website ?? '', type: 'url' })}
        ${field({ label: 'LinkedIn-profiel (URL)', name: 'linkedin', value: s.linkedin ?? '', type: 'url', placeholder: 'https://www.linkedin.com/in/…' })}
        <div class="span-2">${uploadField}</div>
        <div class="span-2">${field({ label: 'Portret-URL (extern of /media/…)', name: 'portrait_url', value: s.portrait_url ?? '' })}</div>
        <div class="span-2">${textarea({ label: 'Biografie (markdown)', name: 'bio_md', value: s.bio_md ?? '', rows: 5 })}</div>
        <div class="span-2">${textarea({ label: 'Interne notities (niet publiek)', name: 'notes', value: s.notes ?? '', rows: 2 })}</div>
        <div class="span-2">${checkbox({ label: 'Toon op de publieke site', name: 'is_public', checked: s.is_public !== 0 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/speakers')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/speakers/${esc(s.id!)}/delete`, 'Spreker verwijderen?')}</div>`}`;
}

speakersApp.get('/new', async (c) =>
  renderAdminLayout(c, { title: 'Nieuwe spreker', activeKey: 'speakers', body: await form(c, { is_public: 1 }, true) })
);

speakersApp.get('/:id', async (c) => {
  const s = await c.env.DB.prepare('SELECT * FROM speakers WHERE id = ?').bind(c.req.param('id')).first<Speaker>();
  if (!s) return redirectErr(c, '/admin/speakers', 'Spreker niet gevonden.');
  return renderAdminLayout(c, { title: 'Spreker bewerken', activeKey: 'speakers', body: await form(c, s, false) });
});

/** Bepaalt de nieuwe portret-URL: upload heeft voorrang, anders het URL-veld. */
async function resolvePortrait(
  c: any,
  body: Record<string, unknown>,
  current: string | null
): Promise<string | null> {
  const file = body.portrait_file;
  if (file instanceof File && file.size > 0) {
    const url = await uploadImage(c.env, file, 'speakers');
    if (current && current.startsWith('/media/')) await deleteMedia(c.env, current);
    return url;
  }
  return strOrNull(body.portrait_url);
}

/** Beroep-keuze + afgeleide categorie (categorie volgt het gekozen beroep). */
async function resolveBeroepCat(
  c: any,
  b: Record<string, unknown>
): Promise<{ beroepId: number | null; categoryId: string | null }> {
  const beroepId = intOrNull(b.beroep_id);
  let categoryId = strOrNull(b.category_id);
  if (beroepId !== null) {
    const row = await c.env.DB.prepare('SELECT category_id FROM beroepen WHERE id = ?')
      .bind(beroepId)
      .first();
    if (row?.category_id) categoryId = row.category_id as string;
  }
  return { beroepId, categoryId };
}

speakersApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  const id = `spk_${crypto.randomUUID().slice(0, 12)}`;
  let portrait: string | null;
  try {
    portrait = await resolvePortrait(c, b, null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, '/admin/speakers/new', e.message);
    throw e;
  }
  const { beroepId, categoryId } = await resolveBeroepCat(c, b);
  await c.env.DB.prepare(
    `INSERT INTO speakers (id, full_name, email, phone, organization, job_title, bio_md, portrait_url, website, linkedin, category_id, beroep_id, is_public, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, str(b.full_name), strOrNull(b.email), strOrNull(b.phone), strOrNull(b.organization), strOrNull(b.job_title), strOrNull(b.bio_md), portrait, strOrNull(b.website), strOrNull(b.linkedin), categoryId, beroepId, bool(b.is_public), strOrNull(b.notes))
    .run();
  await logAudit(c, 'create', 'speaker', id);
  return redirectOk(c, '/admin/speakers', 'Spreker aangemaakt.');
});

speakersApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT portrait_url FROM speakers WHERE id = ?').bind(id).first<{ portrait_url: string | null }>();
  const b = await c.req.parseBody();
  let portrait: string | null;
  try {
    portrait = await resolvePortrait(c, b, cur?.portrait_url ?? null);
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, `/admin/speakers/${id}`, e.message);
    throw e;
  }
  const { beroepId, categoryId } = await resolveBeroepCat(c, b);
  await c.env.DB.prepare(
    `UPDATE speakers SET full_name = ?, email = ?, phone = ?, organization = ?, job_title = ?, bio_md = ?, portrait_url = ?, website = ?, linkedin = ?, category_id = ?, beroep_id = ?, is_public = ?, notes = ?, updated_at = unixepoch() WHERE id = ?`
  )
    .bind(str(b.full_name), strOrNull(b.email), strOrNull(b.phone), strOrNull(b.organization), strOrNull(b.job_title), strOrNull(b.bio_md), portrait, strOrNull(b.website), strOrNull(b.linkedin), categoryId, beroepId, bool(b.is_public), strOrNull(b.notes), id)
    .run();
  await logAudit(c, 'update', 'speaker', id);
  return redirectOk(c, '/admin/speakers', 'Spreker opgeslagen.');
});

speakersApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT portrait_url FROM speakers WHERE id = ?').bind(id).first<{ portrait_url: string | null }>();
  if (cur?.portrait_url) await deleteMedia(c.env, cur.portrait_url);
  await c.env.DB.prepare('DELETE FROM speakers WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'speaker', id);
  return redirectOk(c, '/admin/speakers', 'Spreker verwijderd.');
});
