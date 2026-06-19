/** Audit-log viewer (alleen-lezen). */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader } from '../../views/admin/layout';

export const auditApp = new Hono<AdminEnv>();

const dateNL = (u: number) =>
  new Date(u * 1000).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

auditApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.created_at, a.action, a.entity_type, a.entity_id, a.ip_address, u.name AS user_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 250`
  ).all<{ created_at: number; action: string; entity_type: string | null; entity_id: string | null; ip_address: string | null; user_name: string | null }>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
        <td class="muted">${dateNL(r.created_at)}</td>
        <td>${esc(r.user_name ?? 'systeem')}</td>
        <td><span class="badge badge--off">${esc(r.action)}</span></td>
        <td>${esc(r.entity_type ?? '')}${r.entity_id ? ` <span class="muted mono">${esc(r.entity_id)}</span>` : ''}</td>
        <td class="muted mono">${esc(r.ip_address ?? '')}</td>
      </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Audit-log')}
    <p class="muted">De laatste 250 acties in het beheer.</p>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Wanneer</th><th>Wie</th><th>Actie</th><th>Object</th><th>IP</th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen activiteit.</td></tr>'}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Audit-log', activeKey: 'audit', body });
});
