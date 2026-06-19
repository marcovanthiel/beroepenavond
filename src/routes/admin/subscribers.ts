/** Nieuwsbrief-abonnees: lijst, status, CSV-export. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery } from '../../views/admin/layout';
import { redirectOk } from '../../lib/forms';

export const subscribersApp = new Hono<AdminEnv>();

interface Subr {
  id: number;
  email: string;
  name: string | null;
  status: string;
  confirmed_at: number | null;
  created_at: number;
}

const dateNL = (u: number | null) =>
  u ? new Date(u * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

subscribersApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all<Subr>();
  const all = rows.results ?? [];
  const counts = {
    active: all.filter((s) => s.status === 'active').length,
    pending: all.filter((s) => s.status === 'pending').length,
    unsub: all.filter((s) => s.status === 'unsubscribed').length,
  };
  const badge: Record<string, string> = {
    active: '<span class="badge badge--on">Actief</span>',
    pending: '<span class="badge badge--off">Niet bevestigd</span>',
    unsubscribed: '<span class="badge badge--off">Uitgeschreven</span>',
  };
  const list = all
    .map(
      (s) => `<tr>
        <td><strong>${esc(s.email)}</strong></td>
        <td>${esc(s.name ?? '')}</td>
        <td>${badge[s.status] ?? s.status}</td>
        <td class="muted">${dateNL(s.created_at)}</td>
        <td class="actions"><form method="post" action="/admin/subscribers/${s.id}/delete" onsubmit="return confirm('Verwijderen?')" class="inline-form"><button class="btn btn--danger btn--sm">Verwijderen</button></form></td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Nieuwsbrief', '<a class="btn btn--primary" href="/admin/subscribers/export.csv">Export actieve (CSV)</a>')}
    <div class="stat-grid">
      <div class="stat"><div class="stat__n">${counts.active}</div><div class="stat__l">Actief</div></div>
      <div class="stat"><div class="stat__n">${counts.pending}</div><div class="stat__l">Niet bevestigd</div></div>
      <div class="stat"><div class="stat__n">${counts.unsub}</div><div class="stat__l">Uitgeschreven</div></div>
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>E-mail</th><th>Naam</th><th>Status</th><th>Aangemeld</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen aanmeldingen.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Nieuwsbrief', activeKey: 'subscribers', body, flash: flashFromQuery(c) });
});

subscribersApp.get('/export.csv', async (c) => {
  const rows = await c.env.DB.prepare("SELECT email, name, confirmed_at FROM subscribers WHERE status='active' ORDER BY email").all<Subr>();
  const esc2 = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['email,naam,bevestigd_op']
    .concat((rows.results ?? []).map((r) => [esc2(r.email), esc2(r.name), esc2(dateNL(r.confirmed_at))].join(',')))
    .join('\n');
  await logAudit(c, 'export', 'subscribers');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="nieuwsbrief-abonnees.csv"',
    },
  });
});

subscribersApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM subscribers WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'subscriber', id);
  return redirectOk(c, '/admin/subscribers', 'Abonnee verwijderd.');
});
