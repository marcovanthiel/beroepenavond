/** Edities (events). Eén actief tegelijk via is_active. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import type { EventRow } from '../../lib/db';
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
import { str, strOrNull, bool, intOr, genId, redirectOk, redirectErr } from '../../lib/forms';

export const eventsApp = new Hono<AdminEnv>();

eventsApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM events ORDER BY year DESC'
  ).all<EventRow>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>${r.year}</td>
        <td><strong>${esc(r.title)}</strong></td>
        <td>${esc(r.date)}</td>
        <td>${r.is_active ? '<span class="badge badge--on">Actief</span>' : `<form method="post" action="/admin/events/${esc(r.id)}/activate" class="inline-form"><button class="btn btn--link btn--sm" type="submit">Activeren</button></form>`}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/events/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Edities', '<a class="btn btn--primary" href="/admin/events/new">Nieuwe editie</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Jaar</th><th>Titel</th><th>Datum</th><th>Status</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen edities.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Edities', activeKey: 'events', body, flash: flashFromQuery(c) });
});

function form(ev: Partial<EventRow>, isNew: boolean): string {
  return `
    ${pageHeader(isNew ? 'Nieuwe editie' : `Editie ${esc(String(ev.year ?? ''))}`)}
    <form method="post" action="/admin/events/${isNew ? 'new' : esc(ev.id!)}" class="card">
      <div class="form-grid cols-2">
        ${field({ label: 'Jaar', name: 'year', value: ev.year ?? 2026, type: 'number', required: true })}
        ${field({ label: 'Datum', name: 'date', value: ev.date ?? '', type: 'date', required: true })}
        <div class="span-2">${field({ label: 'Titel', name: 'title', value: ev.title ?? '', required: true })}</div>
        ${field({ label: 'Locatie', name: 'venue_name', value: ev.venue_name ?? '', required: true })}
        ${field({ label: 'Adres', name: 'venue_address', value: ev.venue_address ?? '' })}
        <div class="span-2">${textarea({ label: 'Introductie (markdown)', name: 'intro_md', value: ev.intro_md ?? '', rows: 5 })}</div>
        <div class="span-2">${checkbox({ label: 'Actieve editie (toont op de site)', name: 'is_active', checked: ev.is_active === 1 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/events')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/events/${esc(ev.id!)}/delete`, 'Editie met alle gekoppelde rondes/lokalen/sessies verwijderen?')}</div>`}`;
}

eventsApp.get('/new', (c) =>
  renderAdminLayout(c, { title: 'Nieuwe editie', activeKey: 'events', body: form({ year: 2026, is_active: 0 }, true) })
);

eventsApp.get('/:id', async (c) => {
  const ev = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first<EventRow>();
  if (!ev) return redirectErr(c, '/admin/events', 'Editie niet gevonden.');
  return renderAdminLayout(c, { title: 'Editie bewerken', activeKey: 'events', body: form(ev, false) });
});

eventsApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  const id = genId('ev');
  const active = bool(b.is_active);
  if (active) await c.env.DB.prepare('UPDATE events SET is_active = 0').run();
  await c.env.DB.prepare(
    'INSERT INTO events (id, year, title, date, venue_name, venue_address, intro_md, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, intOr(b.year, 2026), str(b.title), str(b.date), str(b.venue_name), strOrNull(b.venue_address), strOrNull(b.intro_md), active)
    .run();
  await logAudit(c, 'create', 'event', id);
  return redirectOk(c, '/admin/events', 'Editie aangemaakt.');
});

eventsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  const active = bool(b.is_active);
  if (active) await c.env.DB.prepare('UPDATE events SET is_active = 0').run();
  await c.env.DB.prepare(
    'UPDATE events SET year = ?, title = ?, date = ?, venue_name = ?, venue_address = ?, intro_md = ?, is_active = ?, updated_at = unixepoch() WHERE id = ?'
  )
    .bind(intOr(b.year, 2026), str(b.title), str(b.date), str(b.venue_name), strOrNull(b.venue_address), strOrNull(b.intro_md), active, id)
    .run();
  await logAudit(c, 'update', 'event', id);
  return redirectOk(c, '/admin/events', 'Editie opgeslagen.');
});

eventsApp.post('/:id/activate', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE events SET is_active = 0'),
    c.env.DB.prepare('UPDATE events SET is_active = 1 WHERE id = ?').bind(id),
  ]);
  await logAudit(c, 'activate', 'event', id);
  return redirectOk(c, '/admin/events', 'Editie geactiveerd.');
});

eventsApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'event', id);
  return redirectOk(c, '/admin/events', 'Editie verwijderd.');
});
