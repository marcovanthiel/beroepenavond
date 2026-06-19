/** Voorlichtingsrondes binnen de actieve editie. */
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
  formActions,
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, intOr, genId, redirectOk, redirectErr } from '../../lib/forms';

export const roundsApp = new Hono<AdminEnv>();

interface Round {
  id: string;
  event_id: string;
  round_no: number;
  start_time: string;
  end_time: string;
  notes: string | null;
}

function noEvent(c: any) {
  return renderAdminLayout(c, {
    title: 'Rondes',
    activeKey: 'rounds',
    body: `${pageHeader('Rondes')}<div class="card"><p>Maak eerst een <a href="/admin/events">editie</a> aan.</p></div>`,
  });
}

roundsApp.get('/', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return noEvent(c);
  const rows = await c.env.DB.prepare(
    'SELECT * FROM rounds WHERE event_id = ? ORDER BY round_no'
  )
    .bind(ev.id)
    .all<Round>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td>Ronde ${r.round_no}</td>
        <td>${esc(r.start_time)} – ${esc(r.end_time)}</td>
        <td class="muted">${esc(r.notes ?? '')}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/rounds/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader(`Rondes — ${esc(ev.title)}`, '<a class="btn btn--primary" href="/admin/rounds/new">Nieuwe ronde</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Ronde</th><th>Tijd</th><th>Notitie</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="4" class="empty">Nog geen rondes.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Rondes', activeKey: 'rounds', body, flash: flashFromQuery(c) });
});

function form(r: Partial<Round>, isNew: boolean): string {
  return `
    ${pageHeader(isNew ? 'Nieuwe ronde' : `Ronde ${r.round_no}`)}
    <form method="post" action="/admin/rounds/${isNew ? 'new' : esc(r.id!)}" class="card">
      <div class="form-grid cols-2">
        ${field({ label: 'Rondenummer', name: 'round_no', value: r.round_no ?? 1, type: 'number', required: true })}
        <div></div>
        ${field({ label: 'Starttijd', name: 'start_time', value: r.start_time ?? '', type: 'time', required: true })}
        ${field({ label: 'Eindtijd', name: 'end_time', value: r.end_time ?? '', type: 'time', required: true })}
        <div class="span-2">${textarea({ label: 'Notitie (optioneel)', name: 'notes', value: r.notes ?? '', rows: 2 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/rounds')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/rounds/${esc(r.id!)}/delete`, 'Ronde verwijderen?')}</div>`}`;
}

roundsApp.get('/new', (c) =>
  renderAdminLayout(c, { title: 'Nieuwe ronde', activeKey: 'rounds', body: form({ round_no: 1 }, true) })
);

roundsApp.get('/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM rounds WHERE id = ?').bind(c.req.param('id')).first<Round>();
  if (!r) return redirectErr(c, '/admin/rounds', 'Ronde niet gevonden.');
  return renderAdminLayout(c, { title: 'Ronde bewerken', activeKey: 'rounds', body: form(r, false) });
});

roundsApp.post('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/rounds', 'Geen actieve editie.');
  const b = await c.req.parseBody();
  const id = genId('rnd');
  await c.env.DB.prepare(
    'INSERT INTO rounds (id, event_id, round_no, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, ev.id, intOr(b.round_no, 1), str(b.start_time), str(b.end_time), strOrNull(b.notes))
    .run();
  await logAudit(c, 'create', 'round', id);
  return redirectOk(c, '/admin/rounds', 'Ronde aangemaakt.');
});

roundsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  await c.env.DB.prepare(
    'UPDATE rounds SET round_no = ?, start_time = ?, end_time = ?, notes = ? WHERE id = ?'
  )
    .bind(intOr(b.round_no, 1), str(b.start_time), str(b.end_time), strOrNull(b.notes), id)
    .run();
  await logAudit(c, 'update', 'round', id);
  return redirectOk(c, '/admin/rounds', 'Ronde opgeslagen.');
});

roundsApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM rounds WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'round', id);
  return redirectOk(c, '/admin/rounds', 'Ronde verwijderd.');
});
