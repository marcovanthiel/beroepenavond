/** Media-bibliotheek: overzicht van R2-objecten, uploaden, verwijderen. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery } from '../../views/admin/layout';
import { redirectOk, redirectErr } from '../../lib/forms';
import { uploadImage, r2Available, UploadError } from '../../lib/media';

export const mediaApp = new Hono<AdminEnv>();

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

mediaApp.get('/', async (c) => {
  if (!r2Available(c.env)) {
    return renderAdminLayout(c, {
      title: 'Mediatheek',
      activeKey: 'media',
      body: `${pageHeader('Mediatheek')}<div class="card"><p>De R2-bucket is niet gekoppeld in deze omgeving.</p></div>`,
    });
  }
  const listed = await c.env.ASSETS_R2!.list({ limit: 500 });
  const objects = listed.objects.sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
  const cards = objects
    .map((o) => {
      const url = `/media/${o.key}`;
      const isImg = /\.(jpe?g|png|webp|gif|svg)$/i.test(o.key);
      return `<div class="card-box" style="padding:12px">
        ${isImg ? `<img src="${esc(url)}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;background:#f0f0f0">` : '<div style="aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:#f0f0f0;border-radius:4px">📄</div>'}
        <p class="mono" style="font-size:12px;word-break:break-all;margin:8px 0 4px">${esc(o.key)}</p>
        <p class="muted" style="font-size:12px;margin:0 0 8px">${fmtSize(o.size)}</p>
        <div class="row-actions">
          <button class="btn btn--ghost btn--sm" type="button" onclick="navigator.clipboard.writeText(location.origin+'${esc(url)}');this.textContent='Gekopieerd'">Kopieer URL</button>
          <form method="post" action="/admin/media/delete" onsubmit="return confirm('Bestand verwijderen?')" class="inline-form">
            <input type="hidden" name="key" value="${esc(o.key)}">
            <button class="btn btn--danger btn--sm" type="submit">×</button>
          </form>
        </div>
      </div>`;
    })
    .join('');
  const body = `
    ${pageHeader('Mediatheek')}
    <form method="post" action="/admin/media/upload" enctype="multipart/form-data" class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <input type="file" name="file" accept="image/*" required>
      <button class="btn btn--primary btn--sm" type="submit">Uploaden</button>
      <span class="muted">JPG/PNG/WEBP/SVG, max 8 MB. Komt in de map <code>media/</code>.</span>
    </form>
    <div class="grid grid--auto" style="margin-top:18px">${cards || '<p class="muted">Nog geen bestanden.</p>'}</div>`;
  return renderAdminLayout(c, { title: 'Mediatheek', activeKey: 'media', body, flash: flashFromQuery(c) });
});

mediaApp.post('/upload', async (c) => {
  const b = await c.req.parseBody();
  const file = b.file;
  if (!(file instanceof File) || file.size === 0) return redirectErr(c, '/admin/media', 'Geen bestand gekozen.');
  try {
    const url = await uploadImage(c.env, file, 'media');
    await logAudit(c, 'upload', 'media', url);
    return redirectOk(c, '/admin/media', 'Bestand geüpload.');
  } catch (e) {
    if (e instanceof UploadError) return redirectErr(c, '/admin/media', e.message);
    throw e;
  }
});

mediaApp.post('/delete', async (c) => {
  const b = await c.req.parseBody();
  const key = String(b.key ?? '');
  if (key && c.env.ASSETS_R2) {
    await c.env.ASSETS_R2.delete(key);
    await logAudit(c, 'delete', 'media', key);
  }
  return redirectOk(c, '/admin/media', 'Bestand verwijderd.');
});
