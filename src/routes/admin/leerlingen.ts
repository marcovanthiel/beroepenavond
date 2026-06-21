/** Admin: overzicht van leerling-accounts + hun vragen vooraf. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery } from '../../views/admin/layout';
import { redirectOk } from '../../lib/forms';

export const leerlingenApp = new Hono<AdminEnv>();

const dateNL = (u: number | null) =>
  u ? new Date(u * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const tabs = (active: string) =>
  `<a class="btn ${active === 'list' ? 'btn--primary' : 'btn--ghost'} btn--sm" href="/admin/leerlingen">Leerlingen</a>
   <a class="btn ${active === 'q' ? 'btn--primary' : 'btn--ghost'} btn--sm" href="/admin/leerlingen/vragen">Vragen vooraf</a>`;

leerlingenApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.email, s.school, s.profiel, s.newsletter, s.last_login,
            (SELECT COUNT(*) FROM student_picks p WHERE p.student_id = s.id) AS n_picks
       FROM students s ORDER BY s.created_at DESC LIMIT 500`
  ).all<{ id: string; name: string | null; email: string; school: string | null; profiel: string | null; newsletter: number; last_login: number | null; n_picks: number }>();
  const all = rows.results ?? [];
  const list = all
    .map(
      (r) => `<tr>
        <td><strong>${esc(r.name ?? '—')}</strong><br><span class="muted">${esc(r.email)}</span></td>
        <td>${esc(r.school ?? '')}${r.profiel ? `<br><span class="muted">${esc(r.profiel)}</span>` : ''}</td>
        <td>${r.n_picks}</td>
        <td>${r.newsletter ? '<span class="badge badge--on">Ja</span>' : '<span class="badge badge--off">Nee</span>'}</td>
        <td class="muted">${dateNL(r.last_login)}</td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Leerlingen', tabs('list'))}
    <p class="muted">${all.length} leerling-account(s). "Keuzes" = aantal gekozen beroepen.</p>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Leerling</th><th>School / profiel</th><th>Keuzes</th><th>Nieuwsbrief</th><th>Laatst actief</th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen leerling-accounts.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Leerlingen', activeKey: 'leerlingen', body, flash: flashFromQuery(c) });
});

leerlingenApp.get('/vragen', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT q.id, q.question, q.status, q.created_at, b.name AS beroep, s.name AS student, s.email
       FROM student_questions q
       LEFT JOIN beroepen b ON b.id = q.beroep_id
       LEFT JOIN students s ON s.id = q.student_id
      ORDER BY q.created_at DESC LIMIT 500`
  ).all<{ id: number; question: string; status: string; created_at: number; beroep: string | null; student: string | null; email: string | null }>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr style="${r.status === 'new' ? 'font-weight:500' : ''}">
        <td>${esc(r.beroep ?? 'Algemeen')}</td>
        <td style="white-space:pre-wrap">${esc(r.question)}</td>
        <td>${esc(r.student ?? '')}<br><span class="muted">${esc(r.email ?? '')}</span></td>
        <td>${r.status === 'new' ? '<span class="badge badge--on">Nieuw</span>' : '<span class="badge badge--off">Afgehandeld</span>'}<br><span class="muted">${dateNL(r.created_at)}</span></td>
        <td class="actions">
          ${r.status === 'new' ? `<form method="post" action="/admin/leerlingen/vragen/${r.id}/handle" class="inline-form"><button class="btn btn--ghost btn--sm">Afgehandeld</button></form>` : ''}
          <form method="post" action="/admin/leerlingen/vragen/${r.id}/delete" onsubmit="return confirm('Verwijderen?')" class="inline-form"><button class="btn btn--danger btn--sm">×</button></form>
        </td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Vragen vooraf', tabs('q'))}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Beroep</th><th>Vraag</th><th>Leerling</th><th>Status</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen vragen.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Vragen vooraf', activeKey: 'leerlingen', body, flash: flashFromQuery(c) });
});

leerlingenApp.post('/vragen/:id/handle', async (c) => {
  await c.env.DB.prepare("UPDATE student_questions SET status='handled' WHERE id=?").bind(c.req.param('id')).run();
  await logAudit(c, 'handle', 'student_question', c.req.param('id'));
  return redirectOk(c, '/admin/leerlingen/vragen', 'Vraag afgehandeld.');
});

leerlingenApp.post('/vragen/:id/delete', async (c) => {
  await c.env.DB.prepare('DELETE FROM student_questions WHERE id=?').bind(c.req.param('id')).run();
  await logAudit(c, 'delete', 'student_question', c.req.param('id'));
  return redirectOk(c, '/admin/leerlingen/vragen', 'Vraag verwijderd.');
});
