/** Eigen account: naam wijzigen + wachtwoord wijzigen. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit, verifyPassword, hashPassword } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, field, roleLabel, flashFromQuery } from '../../views/admin/layout';
import { str, redirectOk, redirectErr } from '../../lib/forms';

export const accountApp = new Hono<AdminEnv>();

accountApp.get('/', (c) => {
  const u = c.get('user');
  const body = `
    ${pageHeader('Mijn account')}
    <form method="post" action="/admin/account/profile" class="card" style="max-width:520px">
      <h2>Profiel</h2>
      ${field({ label: 'Naam', name: 'name', value: u.name, required: true })}
      <label class="fld">
        <span class="fld__label">E-mail</span>
        <input class="fld__input" type="email" value="${esc(u.email)}" readonly>
        <span class="fld__help">Je e-mailadres wijzigen kan een beheerder doen via Gebruikers.</span>
      </label>
      <p class="muted">Rol: <strong>${esc(roleLabel(u.role))}</strong></p>
      <div class="form-actions"><button class="btn btn--primary" type="submit">Naam opslaan</button></div>
    </form>
    <div class="card" style="max-width:520px">
      <h2>Inloggen</h2>
      <p class="muted" style="margin:0">Inloggen gaat via een <strong>e-mailcode</strong> die we je toesturen. Een wachtwoord heb je niet nodig.</p>
    </div>`;
  return renderAdminLayout(c, { title: 'Mijn account', activeKey: 'account', body, flash: flashFromQuery(c) });
});

accountApp.post('/profile', async (c) => {
  const u = c.get('user');
  const b = await c.req.parseBody();
  const name = str(b.name);
  if (!name) return redirectErr(c, '/admin/account', 'Naam mag niet leeg zijn.');
  await c.env.DB.prepare('UPDATE users SET name = ?, updated_at = unixepoch() WHERE id = ?').bind(name, u.id).run();
  await logAudit(c, 'update', 'account', u.id);
  return redirectOk(c, '/admin/account', 'Naam opgeslagen.');
});

accountApp.post('/password', async (c) => {
  const u = c.get('user');
  const b = await c.req.parseBody();
  const cur = await c.env.DB.prepare('SELECT pw_hash FROM users WHERE id = ?').bind(u.id).first<{ pw_hash: string }>();
  if (!cur || !(await verifyPassword(str(b.current), cur.pw_hash))) {
    return redirectErr(c, '/admin/account', 'Huidig wachtwoord klopt niet.');
  }
  const n1 = str(b.new1);
  if (n1.length < 10) return redirectErr(c, '/admin/account', 'Nieuw wachtwoord is te kort (min. 10).');
  if (n1 !== str(b.new2)) return redirectErr(c, '/admin/account', 'De nieuwe wachtwoorden komen niet overeen.');
  await c.env.DB.prepare('UPDATE users SET pw_hash = ?, updated_at = unixepoch() WHERE id = ?').bind(await hashPassword(n1), u.id).run();
  await logAudit(c, 'password_change', 'account', u.id);
  return redirectOk(c, '/admin/account', 'Wachtwoord gewijzigd.');
});
