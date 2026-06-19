/** Lokalen binnen de actieve editie. map_shape wordt meestal via de
 *  plattegrond-editor gezet, maar is hier ook als ruwe JSON te bewerken. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { getActiveEvent } from '../../lib/db';
import {
  renderAdminLayout,
  esc,
  pageHeader,
  field,
  textarea,
  select,
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, intOrNull, genId, redirectOk, redirectErr } from '../../lib/forms';

export const classroomsApp = new Hono<AdminEnv>();

interface Classroom {
  id: string;
  event_id: string;
  code: string;
  name: string | null;
  floor: string | null;
  capacity: number | null;
  map_shape: string | null;
  map_floor: string | null;
  notes: string | null;
}

async function floorOptions(c: any, eventId: string) {
  const fp = await c.env.DB.prepare(
    'SELECT floor_slug, floor_label FROM floorplans WHERE event_id = ? ORDER BY sort_order'
  )
    .bind(eventId)
    .all();
  return (fp.results ?? []).map((x: any) => ({ value: x.floor_slug, label: x.floor_label }));
}

classroomsApp.get('/', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev)
    return renderAdminLayout(c, {
      title: 'Lokalen',
      activeKey: 'classrooms',
      body: `${pageHeader('Lokalen')}<div class="card"><p>Maak eerst een <a href="/admin/events">editie</a> aan.</p></div>`,
    });
  const rows = await c.env.DB.prepare(
    'SELECT * FROM classrooms WHERE event_id = ? ORDER BY code'
  )
    .bind(ev.id)
    .all<Classroom>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td><strong>${esc(r.code)}</strong></td>
        <td>${esc(r.name ?? '')}</td>
        <td>${esc(r.floor ?? '')}</td>
        <td>${r.map_shape ? '<span class="badge badge--on">Op kaart</span>' : '<span class="badge badge--off">—</span>'}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/classrooms/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader(`Lokalen — ${esc(ev.title)}`, '<a class="btn btn--primary" href="/admin/classrooms/new">Nieuw lokaal</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Code</th><th>Naam</th><th>Verdieping</th><th>Kaart</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen lokalen.</td></tr>'}</tbody>
    </table></div>
    <p class="muted" style="margin-top:14px">Teken lokalen op de plattegrond via de <a href="/admin/floorplan-editor">plattegrond-editor</a>.</p>`;
  return renderAdminLayout(c, { title: 'Lokalen', activeKey: 'classrooms', body, flash: flashFromQuery(c) });
});

async function form(c: any, eventId: string, r: Partial<Classroom>, isNew: boolean): Promise<string> {
  const floors = await floorOptions(c, eventId);
  return `
    ${pageHeader(isNew ? 'Nieuw lokaal' : `Lokaal ${esc(r.code ?? '')}`)}
    <form method="post" action="/admin/classrooms/${isNew ? 'new' : esc(r.id!)}" class="card">
      <div class="form-grid cols-2">
        ${field({ label: 'Code (bijv. A1.12 / Aula)', name: 'code', value: r.code ?? '', required: true })}
        ${field({ label: 'Naam (optioneel)', name: 'name', value: r.name ?? '' })}
        ${field({ label: 'Verdieping (label)', name: 'floor', value: r.floor ?? '' })}
        ${field({ label: 'Capaciteit', name: 'capacity', value: r.capacity ?? '', type: 'number' })}
        ${floors.length ? select({ label: 'Plattegrond-verdieping', name: 'map_floor', value: r.map_floor ?? '', options: floors, empty: '— geen —' }) : field({ label: 'Plattegrond-verdieping (slug)', name: 'map_floor', value: r.map_floor ?? '' })}
        <div></div>
        <div class="span-2">${textarea({ label: 'map_shape (JSON, meestal via editor)', name: 'map_shape', value: r.map_shape ?? '', rows: 3, mono: true, help: 'Bijv. {"shape":"polygon","points":"10,20 30,40 50,60"}' })}</div>
        <div class="span-2">${textarea({ label: 'Notitie', name: 'notes', value: r.notes ?? '', rows: 2 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/classrooms')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/classrooms/${esc(r.id!)}/delete`, 'Lokaal verwijderen?')}</div>`}`;
}

classroomsApp.get('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/classrooms', 'Geen actieve editie.');
  return renderAdminLayout(c, { title: 'Nieuw lokaal', activeKey: 'classrooms', body: await form(c, ev.id, {}, true) });
});

classroomsApp.get('/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM classrooms WHERE id = ?').bind(c.req.param('id')).first<Classroom>();
  if (!r) return redirectErr(c, '/admin/classrooms', 'Lokaal niet gevonden.');
  return renderAdminLayout(c, { title: 'Lokaal bewerken', activeKey: 'classrooms', body: await form(c, r.event_id, r, false) });
});

classroomsApp.post('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/classrooms', 'Geen actieve editie.');
  const b = await c.req.parseBody();
  const id = genId('room');
  await c.env.DB.prepare(
    'INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, ev.id, str(b.code), strOrNull(b.name), strOrNull(b.floor), intOrNull(b.capacity), strOrNull(b.map_shape), strOrNull(b.map_floor), strOrNull(b.notes))
    .run();
  await logAudit(c, 'create', 'classroom', id);
  return redirectOk(c, '/admin/classrooms', 'Lokaal aangemaakt.');
});

classroomsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    'UPDATE classrooms SET code = ?, name = ?, floor = ?, capacity = ?, map_shape = ?, map_floor = ?, notes = ? WHERE id = ?'
  )
    .bind(str(b.code), strOrNull(b.name), strOrNull(b.floor), intOrNull(b.capacity), strOrNull(b.map_shape), strOrNull(b.map_floor), strOrNull(b.notes), id)
    .run();
  await logAudit(c, 'update', 'classroom', id);
  return redirectOk(c, '/admin/classrooms', 'Lokaal opgeslagen.');
});

classroomsApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM classrooms WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'classroom', id);
  return redirectOk(c, '/admin/classrooms', 'Lokaal verwijderd.');
});
