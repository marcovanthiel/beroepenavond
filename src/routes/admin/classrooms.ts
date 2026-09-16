/** Lokalen binnen de actieve editie. Het overzicht is een aanvinklijst:
 *  per ruimte een 'wordt gebruikt'-vinkje (in_use) plus de bekende info
 *  (code, naam, soort, verdieping, capaciteit, of het op de kaart staat).
 *  map_shape wordt meestal via de plattegrond-editor gezet, maar is bij het
 *  bewerken ook als ruwe JSON aan te passen. */
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
  checkbox,
  formActions,
  filterBar,
  filterEmptyRow,
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
  in_use: number;
}

/** Vertaalt de ruwe 'soort' (uit notes, van de plattegrond-import) naar een
 *  leesbaar label. Onbekende waarden worden ongewijzigd getoond. */
function soortLabel(notes: string | null): string {
  switch ((notes ?? '').trim()) {
    case 'les':
      return 'Leslokaal';
    case 'open':
      return 'Leerplein / open ruimte';
    case 'bijz':
      return 'Bijzondere ruimte';
    case 'dienst':
      return 'Dienstruimte';
    default:
      return notes ?? '';
  }
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
    'SELECT * FROM classrooms WHERE event_id = ? ORDER BY floor, code'
  )
    .bind(ev.id)
    .all<Classroom>();
  const all = rows.results ?? [];
  const total = all.length;
  const used = all.filter((r) => r.in_use).length;

  const list = all
    .map((r) => {
      const cap = r.capacity != null ? String(r.capacity) : '';
      const kaart = r.map_shape
        ? '<span class="badge badge--on">Op kaart</span>'
        : '<span class="badge badge--off">-</span>';
      return `<tr>
        <td class="cell-check"><input type="checkbox" name="use" value="${esc(r.id)}" ${r.in_use ? 'checked' : ''} aria-label="Lokaal ${esc(r.code)} wordt gebruikt"></td>
        <td><strong>${esc(r.code)}</strong></td>
        <td>${esc(r.name ?? '')}</td>
        <td>${esc(soortLabel(r.notes))}</td>
        <td>${esc(r.floor ?? '')}</td>
        <td>${esc(cap)}</td>
        <td>${kaart}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/classrooms/${esc(r.id)}">Bewerken</a></td>
      </tr>`;
    })
    .join('');

  const toolbar = filterBar({
    targetId: 'lok',
    placeholder: 'Zoek op code, naam, soort of verdieping',
    total,
    noun: 'lokalen',
    actionsHtml: `<span class="list-count" data-usecount role="status" aria-live="polite">${used} van ${total} gebruikt</span>`,
  });

  const body = `
    ${pageHeader(`Lokalen · ${esc(ev.title)}`, '<a class="btn btn--primary" href="/admin/classrooms/new">Nieuw lokaal</a>')}
    <p class="muted">Vink aan welke ruimten op de avond worden gebruikt. Alleen aangevinkte lokalen zijn zaal voor een sessie; de rest (kantoren, bergingen, techniek) blijft in het register staan maar telt niet mee. Klik daarna op <strong>Opslaan</strong>.</p>
    ${toolbar}
    <form method="post" action="/admin/classrooms/gebruik" data-no-busy>
      <div class="bulk-tools">
        <button type="button" class="btn btn--ghost btn--sm" data-check-all="1">Alles in beeld aanvinken</button>
        <button type="button" class="btn btn--ghost btn--sm" data-check-all="0">Alles in beeld uitvinken</button>
      </div>
      <div class="table-wrap"><table class="data" id="lok">
        <thead><tr>
          <th>Gebruikt</th><th>Code</th><th>Naam</th><th>Soort</th>
          <th>Verdieping</th><th>Cap.</th><th>Kaart</th><th></th>
        </tr></thead>
        <tbody>${list || '<tr><td colspan="8" class="empty">Nog geen lokalen.</td></tr>'}${filterEmptyRow(8)}</tbody>
      </table></div>
      <div class="form-actions form-actions--sticky">
        <button type="submit" class="btn btn--primary">Opslaan</button>
      </div>
    </form>
    <p class="muted" style="margin-top:14px">Teken lokalen op de plattegrond via de <a href="/admin/floorplan-editor">plattegrond-editor</a>. Een lokaal toevoegen of de gegevens wijzigen kan via <a href="/admin/classrooms/new">Nieuw lokaal</a> of de knop Bewerken.</p>`;
  return renderAdminLayout(c, { title: 'Lokalen', activeKey: 'classrooms', body, flash: flashFromQuery(c) });
});

/** Bewaart de aanvinklijst: alle lokalen van de editie op niet-gebruikt,
 *  daarna de aangevinkte weer op gebruikt. Moet VOOR '/:id' staan, anders
 *  vangt die route 'gebruik' op. */
classroomsApp.post('/gebruik', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/classrooms', 'Geen actieve editie.');
  const b = await c.req.parseBody({ all: true });
  const raw = b.use;
  const ids = (Array.isArray(raw) ? raw : raw != null ? [raw] : []).map((x) => String(x));
  await c.env.DB.prepare('UPDATE classrooms SET in_use = 0 WHERE event_id = ?').bind(ev.id).run();
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await c.env.DB.prepare(
      `UPDATE classrooms SET in_use = 1 WHERE event_id = ? AND id IN (${ph})`
    )
      .bind(ev.id, ...ids)
      .run();
  }
  await logAudit(c, 'update', 'classroom', `gebruik:${ids.length}`);
  return redirectOk(c, '/admin/classrooms', `${ids.length} lokalen op gebruikt gezet.`);
});

async function form(c: any, eventId: string, r: Partial<Classroom>, isNew: boolean): Promise<string> {
  const floors = await floorOptions(c, eventId);
  const inUse = isNew ? true : !!r.in_use;
  return `
    ${pageHeader(isNew ? 'Nieuw lokaal' : `Lokaal ${esc(r.code ?? '')}`)}
    <form method="post" action="/admin/classrooms/${isNew ? 'new' : esc(r.id!)}" class="card">
      <div class="form-grid cols-2">
        ${field({ label: 'Code (bijv. A1.12 / Aula)', name: 'code', value: r.code ?? '', required: true })}
        ${field({ label: 'Naam (optioneel)', name: 'name', value: r.name ?? '' })}
        ${field({ label: 'Verdieping (label)', name: 'floor', value: r.floor ?? '' })}
        ${field({ label: 'Capaciteit', name: 'capacity', value: r.capacity ?? '', type: 'number' })}
        ${floors.length ? select({ label: 'Plattegrond-verdieping', name: 'map_floor', value: r.map_floor ?? '', options: floors, empty: '(geen)' }) : field({ label: 'Plattegrond-verdieping (slug)', name: 'map_floor', value: r.map_floor ?? '' })}
        <div>${checkbox({ label: 'Wordt op de avond gebruikt', name: 'in_use', checked: inUse, help: 'Uit = staat wel in het register maar is geen zaal voor een sessie.' })}</div>
        <div class="span-2">${textarea({ label: 'map_shape (JSON, meestal via editor)', name: 'map_shape', value: r.map_shape ?? '', rows: 3, mono: true, help: 'Bijv. {"shape":"polygon","points":"10,20 30,40 50,60"}' })}</div>
        <div class="span-2">${textarea({ label: 'Notitie / soort', name: 'notes', value: r.notes ?? '', rows: 2, help: 'Uit de plattegrond-import: les, open, bijz of dienst.' })}</div>
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
    'INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes, in_use) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, ev.id, str(b.code), strOrNull(b.name), strOrNull(b.floor), intOrNull(b.capacity), strOrNull(b.map_shape), strOrNull(b.map_floor), strOrNull(b.notes), b.in_use ? 1 : 0)
    .run();
  await logAudit(c, 'create', 'classroom', id);
  return redirectOk(c, '/admin/classrooms', 'Lokaal aangemaakt.');
});

classroomsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    'UPDATE classrooms SET code = ?, name = ?, floor = ?, capacity = ?, map_shape = ?, map_floor = ?, notes = ?, in_use = ? WHERE id = ?'
  )
    .bind(str(b.code), strOrNull(b.name), strOrNull(b.floor), intOrNull(b.capacity), strOrNull(b.map_shape), strOrNull(b.map_floor), strOrNull(b.notes), b.in_use ? 1 : 0, id)
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
