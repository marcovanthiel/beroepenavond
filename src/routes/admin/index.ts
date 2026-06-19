/**
 * Admin-applicatie. Volgorde van registratie is belangrijk:
 *   1. publieke auth-routes (login/setup/logout) — vóór requireAuth
 *   2. requireAuth-middleware
 *   3. dashboard + alle CRUD-submodules — achter de middleware
 */
import { Hono } from 'hono';
import {
  AdminEnv,
  requireAuth,
  getCurrentUser,
  countUsers,
  findUserByEmail,
  createUser,
  createSession,
  destroySession,
  verifyPassword,
  logAudit,
} from '../../lib/auth';
import { renderLogin, renderSetup } from '../../views/admin/login';
import { renderAdminLayout, esc } from '../../views/admin/layout';
import { str, redirectErr } from '../../lib/forms';

import { pagesApp } from './pages';
import { settingsApp } from './settings';
import { eventsApp } from './events';
import { roundsApp } from './rounds';
import { categoriesApp } from './categories';
import { beroepenApp } from './beroepen';
import { speakersApp } from './speakers';
import { classroomsApp } from './classrooms';
import { floorplansApp } from './floorplans';
import { sessionsApp } from './sessions';
import { editorApp } from './floorplan-editor';

export const adminApp = new Hono<AdminEnv>();

// ----------------------------------------------------------------------
// 1. Publieke auth-routes
// ----------------------------------------------------------------------

adminApp.get('/login', async (c) => {
  if (await getCurrentUser(c)) return c.redirect('/admin', 302);
  if ((await countUsers(c.env.DB)) === 0) return renderSetup(c);
  return renderLogin(c, { next: c.req.query('next'), error: c.req.query('err') });
});

adminApp.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = str(body.email);
  const password = str(body.password);
  const next = str(body.next) || '/admin';
  const user = await findUserByEmail(c.env.DB, email);
  if (!user || !(await verifyPassword(password, user.pw_hash))) {
    return renderLogin(c, { next, error: 'Onjuist e-mailadres of wachtwoord.' });
  }
  c.set('user', user);
  await createSession(c, user.id);
  await logAudit(c, 'login', 'user', user.id);
  return c.redirect(next.startsWith('/admin') ? next : '/admin', 302);
});

adminApp.get('/setup', async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.redirect('/admin/login', 302);
  return renderSetup(c);
});

adminApp.post('/setup', async (c) => {
  if ((await countUsers(c.env.DB)) > 0) return c.redirect('/admin/login', 302);
  const body = await c.req.parseBody();
  const name = str(body.name);
  const email = str(body.email);
  const password = str(body.password);
  const password2 = str(body.password2);
  if (!name || !email || password.length < 10) {
    return renderSetup(c, { error: 'Vul alle velden in (wachtwoord min. 10 tekens).' });
  }
  if (password !== password2) {
    return renderSetup(c, { error: 'De wachtwoorden komen niet overeen.' });
  }
  const id = await createUser(c.env.DB, { name, email, password, role: 'admin' });
  const user = await findUserByEmail(c.env.DB, email);
  if (user) {
    c.set('user', user);
    await createSession(c, id);
    await logAudit(c, 'setup_first_admin', 'user', id);
  }
  return c.redirect('/admin', 302);
});

adminApp.post('/logout', async (c) => {
  await destroySession(c);
  return c.redirect('/admin/login', 302);
});

// ----------------------------------------------------------------------
// 2. Vanaf hier: ingelogd vereist
// ----------------------------------------------------------------------

adminApp.use('*', requireAuth);

// ----------------------------------------------------------------------
// 3. Dashboard
// ----------------------------------------------------------------------

adminApp.get('/', async (c) => {
  const db = c.env.DB;
  const q = (sql: string) =>
    db.prepare(sql).first<{ n: number }>().then((r) => r?.n ?? 0);
  const [pages, beroepen, speakers, classrooms, floorplans, sessions, mapped] =
    await Promise.all([
      q('SELECT COUNT(*) n FROM pages'),
      q('SELECT COUNT(*) n FROM beroepen'),
      q('SELECT COUNT(*) n FROM speakers'),
      q('SELECT COUNT(*) n FROM classrooms'),
      q('SELECT COUNT(*) n FROM floorplans'),
      q('SELECT COUNT(*) n FROM sessions_program'),
      q("SELECT COUNT(*) n FROM classrooms WHERE map_shape IS NOT NULL AND map_shape <> ''"),
    ]);
  const ev = await db
    .prepare('SELECT title, date FROM events WHERE is_active = 1 LIMIT 1')
    .first<{ title: string; date: string }>();

  const stat = (n: number, label: string, href: string) =>
    `<a class="stat" href="${href}"><div class="stat__n">${n}</div><div class="stat__l">${esc(
      label
    )}</div></a>`;

  const body = `
    <header class="page-head"><h1>Dashboard</h1></header>
    <div class="card">
      <h2>Actieve editie</h2>
      <p>${ev ? `<strong>${esc(ev.title)}</strong> — ${esc(ev.date)}` : 'Geen actieve editie ingesteld.'}</p>
    </div>
    <div class="stat-grid">
      ${stat(pages, "Pagina's", '/admin/pages')}
      ${stat(beroepen, 'Beroepen', '/admin/beroepen')}
      ${stat(speakers, 'Sprekers', '/admin/speakers')}
      ${stat(classrooms, 'Lokalen', '/admin/classrooms')}
      ${stat(floorplans, 'Plattegronden', '/admin/floorplans')}
      ${stat(sessions, 'Sessies', '/admin/sessions')}
      ${stat(mapped, 'Lokalen op kaart', '/admin/floorplan-editor')}
    </div>
    <div class="card">
      <h2>Snel aan de slag</h2>
      <p class="muted">Beheer de inhoud van de site, vul het programma en
      teken de plattegrond. Wijzigingen zijn direct live.</p>
    </div>`;

  return renderAdminLayout(c, { title: 'Dashboard', activeKey: 'dashboard', body });
});

// ----------------------------------------------------------------------
// 4. CRUD-submodules
// ----------------------------------------------------------------------

adminApp.route('/pages', pagesApp);
adminApp.route('/settings', settingsApp);
adminApp.route('/events', eventsApp);
adminApp.route('/rounds', roundsApp);
adminApp.route('/categories', categoriesApp);
adminApp.route('/beroepen', beroepenApp);
adminApp.route('/speakers', speakersApp);
adminApp.route('/classrooms', classroomsApp);
adminApp.route('/floorplans', floorplansApp);
adminApp.route('/sessions', sessionsApp);
adminApp.route('/floorplan-editor', editorApp);

// Onbekende /admin/* → terug naar dashboard.
adminApp.notFound((c) => redirectErr(c, '/admin', 'Onbekende beheerpagina.'));
