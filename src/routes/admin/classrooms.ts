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
  smartboard: number;
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

  // Distinct waarden voor de kolom-filters (soort + verdieping).
  const soorten = Array.from(new Set(all.map((r) => soortLabel(r.notes)).filter(Boolean))).sort();
  const verdiepingen = Array.from(new Set(all.map((r) => r.floor ?? '').filter(Boolean))).sort();

  const list = all
    .map((r) => {
      const cap = r.capacity != null ? String(r.capacity) : '';
      return `<tr>
        <td class="cell-check" data-sf="${r.in_use ? 1 : 0}"><input type="checkbox" name="use" value="${esc(r.id)}" ${r.in_use ? 'checked' : ''} aria-label="Lokaal ${esc(r.code)} wordt gebruikt"></td>
        <td><strong>${esc(r.code)}</strong></td>
        <td>${esc(r.name ?? '')}</td>
        <td>${esc(soortLabel(r.notes))}</td>
        <td>${esc(r.floor ?? '')}</td>
        <td data-sf="${r.capacity ?? -1}">${esc(cap)}</td>
        <td class="cell-check" data-sf="${r.smartboard ? 1 : 0}"><input type="checkbox" name="sb" value="${esc(r.id)}" ${r.smartboard ? 'checked' : ''} aria-label="Lokaal ${esc(r.code)} heeft een smartboard"></td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/classrooms/${esc(r.id)}">Bewerken</a></td>
      </tr>`;
    })
    .join('');

  const jaNee = (col: number) =>
    `<select data-sf-filter="${col}" aria-label="Filter kolom"><option value="">alle</option><option value="1">ja</option><option value="0">nee</option></select>`;
  const opts = (col: number, values: string[], label: string) =>
    `<select data-sf-filter="${col}" aria-label="Filter ${label}"><option value="">alle</option>${values
      .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
      .join('')}</select>`;
  const txt = (col: number, ph: string) =>
    `<input type="search" data-sf-filter="${col}" placeholder="${esc(ph)}" aria-label="Filter ${esc(ph)}">`;

  const body = `
    ${pageHeader(`Lokalen · ${esc(ev.title)}`, '<a class="btn btn--primary" href="/admin/classrooms/new">Nieuw lokaal</a>')}
    <p class="muted">Vink aan welke ruimten op de avond worden gebruikt en welke een smartboard hebben. Alleen aangevinkte lokalen zijn zaal voor een sessie; de rest blijft in het register staan (en staat gedimd op de plattegrond). Klik op een kolomkop om te sorteren, gebruik de filterregel eronder om te filteren, en klik daarna op <strong>Opslaan</strong>.</p>
    <div class="list-toolbar">
      <div class="list-search"><input type="search" data-sf-search="lok" placeholder="Zoek in alle kolommen" aria-label="Zoek in alle kolommen"></div>
      <span class="list-count" data-sf-count="lok" role="status" aria-live="polite">Totaal: ${total} lokalen</span>
      <span class="list-count" data-usecount role="status" aria-live="polite">${used} van ${total} gebruikt</span>
    </div>
    <form method="post" action="/admin/classrooms/gebruik" data-no-busy>
      <div class="bulk-tools">
        <button type="button" class="btn btn--ghost btn--sm" data-check-all="use:1">Alle zichtbare als gebruikt</button>
        <button type="button" class="btn btn--ghost btn--sm" data-check-all="use:0">Alle zichtbare niet-gebruikt</button>
        <button type="button" class="btn btn--ghost btn--sm" data-check-all="sb:1">Alle zichtbare smartboard ja</button>
        <button type="button" class="btn btn--ghost btn--sm" data-check-all="sb:0">Alle zichtbare smartboard nee</button>
      </div>
      <div class="table-wrap"><table class="data sortable" id="lok" data-sortfilter>
        <thead>
          <tr class="sf-head">
            <th data-sort="bool" title="Klik om te sorteren">Gebruikt</th>
            <th data-sort="text" title="Klik om te sorteren">Code</th>
            <th data-sort="text" title="Klik om te sorteren">Naam</th>
            <th data-sort="text" title="Klik om te sorteren">Soort</th>
            <th data-sort="text" title="Klik om te sorteren">Verdieping</th>
            <th data-sort="num" title="Klik om te sorteren">Cap.</th>
            <th data-sort="bool" title="Klik om te sorteren">Smartboard</th>
            <th></th>
          </tr>
          <tr class="sf-filter">
            <th>${jaNee(0)}</th>
            <th>${txt(1, 'code')}</th>
            <th>${txt(2, 'naam')}</th>
            <th>${opts(3, soorten, 'soort')}</th>
            <th>${opts(4, verdiepingen, 'verdieping')}</th>
            <th>${txt(5, 'cap.')}</th>
            <th>${jaNee(6)}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${list || '<tr><td colspan="8" class="empty">Nog geen lokalen.</td></tr>'}${filterEmptyRow(8)}</tbody>
      </table></div>
      <div class="form-actions form-actions--sticky">
        <button type="submit" class="btn btn--primary">Opslaan</button>
      </div>
    </form>
    <p class="muted" style="margin-top:14px">Teken lokalen op de plattegrond via de <a href="/admin/floorplan-editor">plattegrond-editor</a>. Een lokaal toevoegen of de gegevens wijzigen kan via <a href="/admin/classrooms/new">Nieuw lokaal</a> of de knop Bewerken.</p>`;
  return renderAdminLayout(c, { title: 'Lokalen', activeKey: 'classrooms', body, flash: flashFromQuery(c) });
});

/** Bewaart de aanvinklijst: zet per vlag (in_use, smartboard) eerst alle
 *  lokalen van de editie op 0 en daarna de aangevinkte ids op 1. Moet VOOR
 *  '/:id' staan, anders vangt die route 'gebruik' op. */
classroomsApp.post('/gebruik', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/classrooms', 'Geen actieve editie.');
  const b = await c.req.parseBody({ all: true });
  const idsOf = (raw: unknown) =>
    (Array.isArray(raw) ? raw : raw != null ? [raw] : []).map((x) => String(x));
  const useIds = idsOf(b.use);
  const sbIds = idsOf(b.sb);
  async function apply(col: 'in_use' | 'smartboard', ids: string[]) {
    await c.env.DB.prepare(`UPDATE classrooms SET ${col} = 0 WHERE event_id = ?`).bind(ev!.id).run();
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      await c.env.DB.prepare(
        `UPDATE classrooms SET ${col} = 1 WHERE event_id = ? AND id IN (${ph})`
      )
        .bind(ev!.id, ...ids)
        .run();
    }
  }
  await apply('in_use', useIds);
  await apply('smartboard', sbIds);
  await logAudit(c, 'update', 'classroom', `gebruik:${useIds.length},smartboard:${sbIds.length}`);
  return redirectOk(c, '/admin/classrooms', `Opgeslagen: ${useIds.length} gebruikt, ${sbIds.length} met smartboard.`);
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
        <div>${checkbox({ label: 'Wordt op de avond gebruikt', name: 'in_use', checked: inUse, help: 'Uit = staat wel in het register (gedimd op de plattegrond) maar is geen zaal voor een sessie.' })}</div>
        <div>${checkbox({ label: 'Heeft een smartboard', name: 'smartboard', checked: !!r.smartboard })}</div>
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
    'INSERT INTO classrooms (id, event_id, code, name, floor, capacity, map_shape, map_floor, notes, in_use, smartboard) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, ev.id, str(b.code), strOrNull(b.name), strOrNull(b.floor), intOrNull(b.capacity), strOrNull(b.map_shape), strOrNull(b.map_floor), strOrNull(b.notes), b.in_use ? 1 : 0, b.smartboard ? 1 : 0)
    .run();
  await logAudit(c, 'create', 'classroom', id);
  return redirectOk(c, '/admin/classrooms', 'Lokaal aangemaakt.');
});

classroomsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    'UPDATE classrooms SET code = ?, name = ?, floor = ?, capacity = ?, map_shape = ?, map_floor = ?, notes = ?, in_use = ?, smartboard = ? WHERE id = ?'
  )
    .bind(str(b.code), strOrNull(b.name), strOrNull(b.floor), intOrNull(b.capacity), strOrNull(b.map_shape), strOrNull(b.map_floor), strOrNull(b.notes), b.in_use ? 1 : 0, b.smartboard ? 1 : 0, id)
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
