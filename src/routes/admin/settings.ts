/** Instellingen (key/value) — site-brede waarden voor {{placeholders}}. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery } from '../../views/admin/layout';
import { str, redirectOk } from '../../lib/forms';

export const settingsApp = new Hono<AdminEnv>();

settingsApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT key, value FROM settings ORDER BY key'
  ).all<{ key: string; value: string }>();

  const fields = (rows.results ?? [])
    .map(
      (r) => `<label class="fld">
        <span class="fld__label mono">${esc(r.key)}</span>
        <input class="fld__input" type="text" name="val__${esc(r.key)}" value="${esc(r.value)}">
      </label>`
    )
    .join('');

  const body = `
    ${pageHeader('Instellingen')}
    <form method="post" action="/admin/settings" class="card">
      <p class="muted">Deze waarden komen op de site terug via
        <code>{{sleutel}}</code>-plaatshouders in pagina-teksten.</p>
      <div class="form-grid">${fields}</div>
      <h2 style="margin-top:24px">Nieuwe instelling</h2>
      <div class="form-grid cols-2">
        <label class="fld"><span class="fld__label">Sleutel</span>
          <input class="fld__input mono" type="text" name="new_key" placeholder="bijv. ticket_url"></label>
        <label class="fld"><span class="fld__label">Waarde</span>
          <input class="fld__input" type="text" name="new_value"></label>
      </div>
      <div class="form-actions"><button class="btn btn--primary" type="submit">Opslaan</button></div>
    </form>`;

  return renderAdminLayout(c, {
    title: 'Instellingen',
    activeKey: 'settings',
    body,
    flash: flashFromQuery(c),
  });
});

settingsApp.post('/', async (c) => {
  const body = await c.req.parseBody();
  const stmts = [];
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith('val__')) {
      const key = k.slice('val__'.length);
      stmts.push(
        c.env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(
          str(v),
          key
        )
      );
    }
  }
  const newKey = str(body.new_key);
  if (newKey) {
    stmts.push(
      c.env.DB.prepare(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      ).bind(newKey, str(body.new_value))
    );
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  await logAudit(c, 'update', 'settings');
  return redirectOk(c, '/admin/settings', 'Instellingen opgeslagen.');
});
