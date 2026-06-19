/** Gebruikersbeheer — alleen voor de rol 'admin'. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit, createUser, findUserByEmail, hashPassword } from '../../lib/auth';
import type { UserRow } from '../../env';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  select,
  formActions,
  flashFromQuery,
  roleLabel,
} from '../../views/admin/layout';
import { str, redirectOk, redirectErr } from '../../lib/forms';

export const usersApp = new Hono<AdminEnv>();

// Gate: alleen admins.
usersApp.use('*', async (c, next) => {
  if (c.get('user').role !== 'admin') {
    return renderAdminLayout(c, {
      title: 'Gebruikers',
      activeKey: 'users',
      body: `${pageHeader('Gebruikers')}<div class="card"><p>Alleen beheerders met de rol <strong>admin</strong> kunnen gebruikers beheren.</p></div>`,
    });
  }
  return next();
});

const dateNL = (u: number) => new Date(u * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });

usersApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at').all<UserRow>();
  const me = c.get('user');
  const list = (rows.results ?? [])
    .map(
      (u) => `<tr>
        <td><strong>${esc(u.name)}</strong>${u.id === me.id ? ' <span class="badge badge--off">jij</span>' : ''}</td>
        <td>${esc(u.email)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge--on' : 'badge--off'}">${esc(roleLabel(u.role))}</span></td>
        <td class="muted">${dateNL(u.created_at)}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/users/${esc(u.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Gebruikers', '<a class="btn btn--primary" href="/admin/users/new">Nieuwe gebruiker</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Sinds</th><th></th></tr></thead>
      <tbody>${list}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Gebruikers', activeKey: 'users', body, flash: flashFromQuery(c) });
});

const ROLES = [
  { value: 'editor', label: 'Redacteur (inhoud + programma)' },
  { value: 'admin', label: 'Beheerder (alles incl. gebruikers)' },
];

usersApp.get('/new', (c) => {
  const body = `
    ${pageHeader('Nieuwe gebruiker')}
    <form method="post" action="/admin/users/new" class="card" style="max-width:560px">
      <div class="form-grid">
        ${field({ label: 'Naam', name: 'name', required: true })}
        ${field({ label: 'E-mail', name: 'email', type: 'email', required: true })}
        ${select({ label: 'Rol', name: 'role', value: 'editor', options: ROLES })}
        ${field({ label: 'Wachtwoord (min. 10 tekens)', name: 'password', type: 'password', required: true })}
      </div>
      ${formActions('Aanmaken', '/admin/users')}
    </form>`;
  return renderAdminLayout(c, { title: 'Nieuwe gebruiker', activeKey: 'users', body });
});

usersApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  const email = str(b.email);
  const password = str(b.password);
  if (!str(b.name) || !email || password.length < 10) return redirectErr(c, '/admin/users/new', 'Vul alle velden in (wachtwoord min. 10).');
  if (await findUserByEmail(c.env.DB, email)) return redirectErr(c, '/admin/users/new', 'Er bestaat al een gebruiker met dit e-mailadres.');
  const role = str(b.role) === 'admin' ? 'admin' : 'editor';
  const id = await createUser(c.env.DB, { name: str(b.name), email, password, role });
  await logAudit(c, 'create', 'user', id);
  return redirectOk(c, '/admin/users', 'Gebruiker aangemaakt.');
});

usersApp.get('/:id', async (c) => {
  const u = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(c.req.param('id')).first<UserRow>();
  if (!u) return redirectErr(c, '/admin/users', 'Gebruiker niet gevonden.');
  const me = c.get('user');
  const body = `
    ${pageHeader(`Gebruiker: ${esc(u.name)}`)}
    <form method="post" action="/admin/users/${esc(u.id)}" class="card" style="max-width:560px">
      <div class="form-grid">
        ${field({ label: 'Naam', name: 'name', value: u.name, required: true })}
        ${field({ label: 'E-mail', name: 'email', value: u.email, type: 'email', required: true })}
        ${select({ label: 'Rol', name: 'role', value: u.role, options: ROLES })}
        ${field({ label: 'Nieuw wachtwoord (leeg = ongewijzigd)', name: 'password', type: 'password', help: 'Min. 10 tekens om te wijzigen.' })}
      </div>
      ${formActions('Opslaan', '/admin/users')}
    </form>
    ${u.id === me.id ? '<p class="muted">Je kunt je eigen account niet verwijderen.</p>' : `<div class="card"><form method="post" action="/admin/users/${esc(u.id)}/delete" onsubmit="return confirm('Gebruiker verwijderen?')" class="inline-form"><button class="btn btn--danger btn--sm">Verwijderen</button></form></div>`}`;
  return renderAdminLayout(c, { title: 'Gebruiker', activeKey: 'users', body });
});

usersApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  const role = str(b.role) === 'admin' ? 'admin' : 'editor';
  await c.env.DB.prepare('UPDATE users SET name = ?, email = ?, role = ?, updated_at = unixepoch() WHERE id = ?')
    .bind(str(b.name), str(b.email).toLowerCase(), role, id)
    .run();
  const pw = str(b.password);
  if (pw) {
    if (pw.length < 10) return redirectErr(c, `/admin/users/${id}`, 'Wachtwoord te kort (min. 10).');
    await c.env.DB.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').bind(await hashPassword(pw), id).run();
  }
  await logAudit(c, 'update', 'user', id);
  return redirectOk(c, '/admin/users', 'Gebruiker opgeslagen.');
});

usersApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) return redirectErr(c, '/admin/users', 'Je kunt je eigen account niet verwijderen.');
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'user', id);
  return redirectOk(c, '/admin/users', 'Gebruiker verwijderd.');
});
