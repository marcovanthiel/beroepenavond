/** Inbox: contactberichten + voorlichter-aanmeldingen afhandelen. */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery, filterBar, filterEmptyRow, emptyState } from '../../views/admin/layout';
import { genId, redirectOk, redirectErr } from '../../lib/forms';

export const inboxApp = new Hono<AdminEnv>();

interface Sub {
  id: number;
  type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  profession: string | null;
  message: string | null;
  status: string;
  created_at: number;
}

const dateNL = (u: number) =>
  new Date(u * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS_BADGE: Record<string, string> = {
  new: '<span class="badge badge--on">Nieuw</span>',
  read: '<span class="badge badge--off">Gelezen</span>',
  handled: '<span class="badge badge--on">Afgehandeld</span>',
  archived: '<span class="badge badge--off">Archief</span>',
};

inboxApp.get('/', async (c) => {
  const type = c.req.query('type') ?? '';
  const where: string[] = [];
  const binds: unknown[] = [];
  if (type === 'contact' || type === 'volunteer') {
    where.push('type = ?');
    binds.push(type);
  }
  const sql =
    'SELECT * FROM submissions' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY created_at DESC LIMIT 300';
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<Sub>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr style="${r.status === 'new' ? 'font-weight:500' : ''}">
        <td>${r.type === 'volunteer' ? '🙋 Voorlichter' : '✉️ Contact'}</td>
        <td><strong>${esc(r.name ?? '—')}</strong><br><span class="muted">${esc(r.email ?? '')}</span></td>
        <td>${esc(r.type === 'volunteer' ? r.profession ?? '' : (r.message ?? '').slice(0, 50))}</td>
        <td>${STATUS_BADGE[r.status] ?? r.status}</td>
        <td class="muted">${dateNL(r.created_at)}</td>
        <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/inbox/${r.id}">Bekijk</a></td>
      </tr>`
    )
    .join('');
  const tab = (t: string, label: string) =>
    `<a class="btn ${type === t ? 'btn--primary' : 'btn--ghost'} btn--sm" href="/admin/inbox${t ? `?type=${t}` : ''}">${label}</a>`;
  const total = (rows.results ?? []).length;
  const body = `
    ${pageHeader('Postvak', `${tab('', 'Alles')} ${tab('contact', 'Contact')} ${tab('volunteer', 'Voorlichters')}`)}
    ${filterBar({ targetId: 'tbl-inbox', placeholder: 'Zoek op naam, e-mail of onderwerp…', total, noun: 'berichten' })}
    <div class="table-wrap"><table class="data" id="tbl-inbox">
      <thead><tr><th>Type</th><th>Van</th><th>Onderwerp</th><th>Status</th><th>Datum</th><th></th></tr></thead>
      <tbody>${list ? list + filterEmptyRow(6) : emptyState({ colspan: 6, title: 'Geen berichten.' })}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Postvak', activeKey: 'inbox', body, flash: flashFromQuery(c) });
});

inboxApp.get('/:id', async (c) => {
  const id = c.req.param('id');
  const s = await c.env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<Sub>();
  if (!s) return redirectErr(c, '/admin/inbox', 'Bericht niet gevonden.');
  if (s.status === 'new') await c.env.DB.prepare("UPDATE submissions SET status='read' WHERE id=?").bind(id).run();

  const row = (k: string, v: unknown) =>
    v ? `<tr><td style="color:#6b7280;width:130px;vertical-align:top;padding:6px 0">${esc(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>` : '';
  const statusForm = ['read', 'handled', 'archived']
    .map(
      (st) => `<button class="btn btn--ghost btn--sm" name="status" value="${st}">${st === 'read' ? 'Gelezen' : st === 'handled' ? 'Afgehandeld' : 'Archiveren'}</button>`
    )
    .join(' ');
  const convert = s.type === 'volunteer'
    ? `<form method="post" action="/admin/inbox/${s.id}/to-speaker" class="inline-form" style="margin-top:10px"><button class="btn btn--primary btn--sm">→ Maak spreker aan</button></form>`
    : '';
  const body = `
    ${pageHeader(s.type === 'volunteer' ? 'Voorlichter-aanmelding' : 'Contactbericht', '<a class="btn btn--ghost" href="/admin/inbox">← Terug</a>')}
    <div class="card">
      <table style="width:100%;border-collapse:collapse">
        ${row('Naam', s.name)}${row('E-mail', s.email)}${row('Telefoon', s.phone)}
        ${row('Organisatie', s.organization)}${row('Beroep', s.profession)}${row('Bericht', s.message)}
        ${row('Ontvangen', dateNL(s.created_at))}
      </table>
      <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${s.email ? `<a class="btn btn--primary btn--sm" href="mailto:${esc(s.email)}">Beantwoorden</a>` : ''}
        <form method="post" action="/admin/inbox/${s.id}/status" class="inline-form" style="display:inline-flex;gap:8px">${statusForm}</form>
      </div>
      ${convert}
    </div>
    <div class="card">${`<form method="post" action="/admin/inbox/${s.id}/delete" onsubmit="return confirm('Bericht verwijderen?')" class="inline-form"><button class="btn btn--danger btn--sm">Verwijderen</button></form>`}</div>`;
  return renderAdminLayout(c, { title: 'Bericht', activeKey: 'inbox', body });
});

inboxApp.post('/:id/status', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.parseBody();
  const status = String(b.status);
  if (['read', 'handled', 'archived'].includes(status)) {
    await c.env.DB.prepare('UPDATE submissions SET status = ? WHERE id = ?').bind(status, id).run();
    await logAudit(c, 'status', 'submission', id, { status });
  }
  return redirectOk(c, `/admin/inbox/${id}`, 'Status bijgewerkt.');
});

inboxApp.post('/:id/to-speaker', async (c) => {
  const id = c.req.param('id');
  const s = await c.env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<Sub>();
  if (!s) return redirectErr(c, '/admin/inbox', 'Niet gevonden.');
  const sid = genId('spk');
  await c.env.DB.prepare(
    'INSERT INTO speakers (id, full_name, email, phone, organization, job_title, is_public, notes) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  )
    .bind(sid, s.name ?? 'Onbekend', s.email, s.phone, s.organization, s.profession, `Aangemaakt vanuit aanmelding #${s.id}`)
    .run();
  await c.env.DB.prepare("UPDATE submissions SET status='handled' WHERE id=?").bind(id).run();
  await logAudit(c, 'convert', 'submission', id, { speaker: sid });
  return redirectOk(c, `/admin/speakers/${sid}`, 'Spreker aangemaakt vanuit aanmelding.');
});

inboxApp.post('/:id/delete', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
  await logAudit(c, 'delete', 'submission', id);
  return redirectOk(c, '/admin/inbox', 'Bericht verwijderd.');
});
