/** Beroepssessies (programma) binnen de actieve editie, met M2M-sprekers. */
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
  deleteButton,
  flashFromQuery,
} from '../../views/admin/layout';
import { str, strOrNull, bool, genId, redirectOk, redirectErr } from '../../lib/forms';

export const sessionsApp = new Hono<AdminEnv>();

interface Session {
  id: string;
  event_id: string;
  category_id: string | null;
  classroom_id: string | null;
  round_id: string | null;
  profession: string;
  title: string | null;
  description_md: string | null;
  is_public: number;
}

async function refData(c: any, eventId: string) {
  const [cats, rooms, rounds, speakers] = await Promise.all([
    c.env.DB.prepare('SELECT id, name FROM categories ORDER BY sort_order').all(),
    c.env.DB.prepare('SELECT id, code, name FROM classrooms WHERE event_id = ? ORDER BY code').bind(eventId).all(),
    c.env.DB.prepare('SELECT id, round_no, start_time, end_time FROM rounds WHERE event_id = ? ORDER BY round_no').bind(eventId).all(),
    c.env.DB.prepare('SELECT id, full_name FROM speakers ORDER BY full_name').all(),
  ]);
  return {
    cats: (cats.results ?? []).map((x: any) => ({ value: x.id, label: x.name })),
    rooms: (rooms.results ?? []).map((x: any) => ({ value: x.id, label: x.name ? `${x.code} — ${x.name}` : x.code })),
    rounds: (rounds.results ?? []).map((x: any) => ({ value: x.id, label: `Ronde ${x.round_no} (${x.start_time}–${x.end_time})` })),
    speakers: speakers.results ?? [],
  };
}

sessionsApp.get('/', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev)
    return renderAdminLayout(c, {
      title: 'Sessies',
      activeKey: 'sessions',
      body: `${pageHeader('Sessies')}<div class="card"><p>Maak eerst een <a href="/admin/events">editie</a> aan.</p></div>`,
    });
  const rows = await c.env.DB.prepare(
    `SELECT s.*, cat.name AS cat_name, cat.color AS cat_color, cr.code AS room_code, r.round_no AS round_no,
            (SELECT COUNT(*) FROM session_speakers ss WHERE ss.session_id = s.id) AS n_speakers
       FROM sessions_program s
       LEFT JOIN categories cat ON cat.id = s.category_id
       LEFT JOIN classrooms cr ON cr.id = s.classroom_id
       LEFT JOIN rounds r ON r.id = s.round_id
      WHERE s.event_id = ?
      ORDER BY s.profession`
  )
    .bind(ev.id)
    .all<Session & { cat_name: string; cat_color: string; room_code: string; round_no: number; n_speakers: number }>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td><strong>${esc(r.profession)}</strong>${r.title ? `<br><span class="muted">${esc(r.title)}</span>` : ''}</td>
        <td>${r.cat_name ? `<span class="swatch" style="background:${esc(r.cat_color ?? '#ccc')}"></span>${esc(r.cat_name)}` : '<span class="muted">—</span>'}</td>
        <td>${esc(r.room_code ?? '—')}</td>
        <td>${r.round_no ? `Ronde ${r.round_no}` : '—'}</td>
        <td>${r.n_speakers}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/sessions/${esc(r.id)}">Bewerken</a></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader(`Sessies — ${esc(ev.title)}`, '<a class="btn btn--primary" href="/admin/sessions/new">Nieuwe sessie</a>')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Beroep</th><th>Categorie</th><th>Lokaal</th><th>Ronde</th><th>Sprekers</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="6" class="empty">Nog geen sessies.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Sessies', activeKey: 'sessions', body, flash: flashFromQuery(c) });
});

async function form(c: any, eventId: string, s: Partial<Session>, selectedSpeakers: Set<string>, isNew: boolean): Promise<string> {
  const ref = await refData(c, eventId);
  const speakerChecks = ref.speakers.length
    ? ref.speakers
        .map(
          (sp: any) => `<label class="fld--check fld"><input type="checkbox" name="speaker_ids" value="${esc(sp.id)}" ${selectedSpeakers.has(sp.id) ? 'checked' : ''}><span>${esc(sp.full_name)}</span></label>`
        )
        .join('')
    : '<p class="muted">Nog geen sprekers — voeg ze toe onder Sprekers.</p>';
  return `
    ${pageHeader(isNew ? 'Nieuwe sessie' : esc(s.profession ?? 'Sessie'))}
    <form method="post" action="/admin/sessions/${isNew ? 'new' : esc(s.id!)}" class="card">
      <div class="form-grid cols-2">
        <div class="span-2">${field({ label: 'Beroep', name: 'profession', value: s.profession ?? '', required: true })}</div>
        <div class="span-2">${field({ label: 'Presentatietitel (optioneel)', name: 'title', value: s.title ?? '' })}</div>
        ${select({ label: 'Categorie', name: 'category_id', value: s.category_id ?? '', options: ref.cats, empty: '— geen —' })}
        ${select({ label: 'Lokaal', name: 'classroom_id', value: s.classroom_id ?? '', options: ref.rooms, empty: '— geen —' })}
        ${select({ label: 'Ronde', name: 'round_id', value: s.round_id ?? '', options: ref.rounds, empty: '— geen —' })}
        <div></div>
        <div class="span-2">${textarea({ label: 'Omschrijving (markdown)', name: 'description_md', value: s.description_md ?? '', rows: 4 })}</div>
        <div class="span-2">
          <span class="fld__label">Sprekers</span>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;margin-top:6px">${speakerChecks}</div>
        </div>
        <div class="span-2">${checkbox({ label: 'Tonen op publieke site', name: 'is_public', checked: s.is_public !== 0 })}</div>
      </div>
      ${formActions('Opslaan', '/admin/sessions')}
    </form>
    ${isNew ? '' : `<div class="card">${deleteButton(`/admin/sessions/${esc(s.id!)}/delete`, 'Sessie verwijderen?')}</div>`}`;
}

function speakerIds(body: Record<string, unknown>): string[] {
  const v = body.speaker_ids;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return [v];
  return [];
}

async function saveSpeakers(c: any, sessionId: string, ids: string[]) {
  const stmts = [c.env.DB.prepare('DELETE FROM session_speakers WHERE session_id = ?').bind(sessionId)];
  ids.forEach((sid, i) =>
    stmts.push(
      c.env.DB.prepare('INSERT OR IGNORE INTO session_speakers (session_id, speaker_id, sort_order) VALUES (?, ?, ?)').bind(sessionId, sid, i)
    )
  );
  await c.env.DB.batch(stmts);
}

sessionsApp.get('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/sessions', 'Geen actieve editie.');
  return renderAdminLayout(c, { title: 'Nieuwe sessie', activeKey: 'sessions', body: await form(c, ev.id, { is_public: 1 }, new Set(), true) });
});

sessionsApp.get('/:id', async (c) => {
  const s = await c.env.DB.prepare('SELECT * FROM sessions_program WHERE id = ?').bind(c.req.param('id')).first<Session>();
  if (!s) return redirectErr(c, '/admin/sessions', 'Sessie niet gevonden.');
  const sp = await c.env.DB.prepare('SELECT speaker_id FROM session_speakers WHERE session_id = ?').bind(s.id).all<{ speaker_id: string }>();
  const selected = new Set((sp.results ?? []).map((x) => x.speaker_id));
  return renderAdminLayout(c, { title: 'Sessie bewerken', activeKey: 'sessions', body: await form(c, s.event_id, s, selected, false) });
});

sessionsApp.post('/new', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev) return redirectErr(c, '/admin/sessions', 'Geen actieve editie.');
  const b = await c.req.parseBody({ all: true });
  const id = genId('ses');
  await c.env.DB.prepare(
    'INSERT INTO sessions_program (id, event_id, category_id, classroom_id, round_id, profession, title, description_md, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, ev.id, strOrNull(b.category_id), strOrNull(b.classroom_id), strOrNull(b.round_id), str(b.profession), strOrNull(b.title), strOrNull(b.description_md), bool(b.is_public))
    .run();
  await saveSpeakers(c, id, speakerIds(b));
  await logAudit(c, 'create', 'session', id);
  return redirectOk(c, '/admin/sessions', 'Sessie aangemaakt.');
});

sessionsApp.post('/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody({ all: true });
  await c.env.DB.prepare(
    'UPDATE sessions_program SET category_id = ?, classroom_id = ?, round_id = ?, profession = ?, title = ?, description_md = ?, is_public = ?, updated_at = unixepoch() WHERE id = ?'
  )
    .bind(strOrNull(b.category_id), strOrNull(b.classroom_id), strOrNull(b.round_id), str(b.profession), strOrNull(b.title), strOrNull(b.description_md), bool(b.is_public), id)
    .run();
  await saveSpeakers(c, id, speakerIds(b));
  await logAudit(c, 'update', 'session', id);
  return redirectOk(c, '/admin/sessions', 'Sessie opgeslagen.');
});

sessionsApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM sessions_program WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'session', id);
  return redirectOk(c, '/admin/sessions', 'Sessie verwijderd.');
});
