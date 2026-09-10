/**
 * Mailbox-beheer: inkomende mail lezen, bijlagen downloaden, beantwoorden
 * (via de bestaande verzendweg, met In-Reply-To voor nette threading) en
 * afhandelen. Domein-neutraal: afzender komt uit settings (mail_from).
 */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery, filterBar, filterEmptyRow, backLink } from '../../views/admin/layout';
import { str, redirectOk, redirectErr } from '../../lib/forms';
import { getSettings } from '../../lib/db';
import { mailConfig, sendEmail, emailShell } from '../../lib/email';

export const mailboxApp = new Hono<AdminEnv>();

interface InboxRow {
  id: number; message_id: string | null; from_email: string; from_name: string | null;
  to_email: string; subject: string | null; body_text: string | null;
  attachments: string; status: string; speaker_id: string | null;
  received_at: number; answered_at: number | null;
}

const dat = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : '-';

function bijlagen(r: InboxRow): { key: string; filename: string; size: number; blocked: boolean }[] {
  try { return JSON.parse(r.attachments); } catch { return []; }
}

mailboxApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT m.*, sp.full_name AS speaker_name FROM mail_inbox m
     LEFT JOIN speakers sp ON sp.id = m.speaker_id
     ORDER BY m.received_at DESC LIMIT 300`
  ).all<InboxRow & { speaker_name: string | null }>();
  const list = (rows.results ?? [])
    .map((r) => {
      const atts = bijlagen(r as InboxRow);
      return `<tr${r.status === 'nieuw' ? ' style="font-weight:600"' : ''}>
      <td><a href="/admin/mailbox/${r.id}">${esc(r.subject || '(zonder onderwerp)')}</a>${atts.length ? ` 📎${atts.length}` : ''}</td>
      <td>${esc(r.from_name || r.from_email)}${r.speaker_name ? `<br><span class="muted">voorlichter: ${esc(r.speaker_name)}</span>` : ''}</td>
      <td>${esc(r.to_email)}</td>
      <td>${r.status === 'nieuw' ? '<span class="badge badge--off">Nieuw</span>' : r.status === 'afgehandeld' ? '<span class="badge badge--on">Afgehandeld</span>' : 'Gelezen'}${r.answered_at ? '<br><span class="muted" style="font-size:.75rem">beantwoord</span>' : ''}</td>
      <td>${dat(r.received_at)}</td>
    </tr>`;
    })
    .join('');
  const body = `
    ${pageHeader('Mailbox (inkomende e-mail)')}
    <p class="muted">Alle mail aan de site-adressen komt hier binnen. De afzender krijgt automatisch een
    ontvangstbevestiging; gevaarlijke bijlagen worden geweigerd en gemeld.</p>
    ${filterBar({ targetId: 'mail-tabel', placeholder: 'Zoek op afzender of onderwerp…', total: (rows.results ?? []).length, noun: 'mails' })}
    <div class="table-wrap"><table class="data" id="mail-tabel">
      <thead><tr><th>Onderwerp</th><th>Van</th><th>Aan</th><th>Status</th><th>Ontvangen</th></tr></thead>
      <tbody>${list || '<tr><td colspan="5" class="empty">Nog geen inkomende mail.</td></tr>'}${filterEmptyRow(5)}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Mailbox', activeKey: 'mailbox', body, flash: flashFromQuery(c) });
});

mailboxApp.get('/:id{[0-9]+}', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const r = await c.env.DB.prepare('SELECT * FROM mail_inbox WHERE id = ?').bind(id).first<InboxRow>();
  if (!r) return redirectErr(c, '/admin/mailbox', 'Mail niet gevonden.');
  if (r.status === 'nieuw') {
    await c.env.DB.prepare("UPDATE mail_inbox SET status='gelezen' WHERE id = ?").bind(id).run();
  }
  const atts = bijlagen(r);
  const attHtml = atts.length
    ? `<div class="card" style="margin:14px 0"><strong>Bijlagen</strong><ul style="margin:8px 0 0">${atts
        .map((a, i) => a.blocked
          ? `<li>${esc(a.filename)} <span class="badge badge--off">geweigerd</span></li>`
          : `<li><a href="/admin/mailbox/${id}/bijlage/${i}">${esc(a.filename)}</a> <span class="muted">(${Math.round(a.size / 1024)} kB)</span></li>`)
        .join('')}</ul></div>`
    : '';
  const body = `
    ${pageHeader(esc(r.subject || '(zonder onderwerp)'))}
    ${backLink('/admin/mailbox', 'Alle mail')}
    <div class="card" style="margin:14px 0">
      <p class="muted" style="margin:0 0 10px">Van <strong>${esc(r.from_name || '')} &lt;${esc(r.from_email)}&gt;</strong>
      aan ${esc(r.to_email)} · ${dat(r.received_at)}${r.answered_at ? ` · beantwoord ${dat(r.answered_at)}` : ''}</p>
      <div style="white-space:pre-wrap;border-top:1px solid #e5e5e5;padding-top:12px">${esc(r.body_text || '')}</div>
    </div>
    ${attHtml}
    <div class="card" style="margin:14px 0">
      <h3 style="margin-top:0">Beantwoorden</h3>
      <form method="post" action="/admin/mailbox/${id}/antwoord">
        <label class="fld"><span class="fld__label">Antwoord (wordt in de huisstijl-mail verstuurd)</span>
        <textarea class="fld__input" name="body" rows="7" required placeholder="Beste ${esc(r.from_name || '')},"></textarea></label>
        <button class="btn btn--primary" type="submit">Verstuur antwoord</button>
      </form>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <form method="post" action="/admin/mailbox/${id}/status" class="inline-form"><input type="hidden" name="status" value="afgehandeld"><button class="btn btn--ghost" type="submit">Markeer afgehandeld</button></form>
      <form method="post" action="/admin/mailbox/${id}/verwijder" class="inline-form"><button class="btn btn--ghost" data-confirm="Mail en bijlagen definitief verwijderen?" type="submit">Verwijderen</button></form>
    </div>`;
  return renderAdminLayout(c, { title: 'Mail', activeKey: 'mailbox', body, flash: flashFromQuery(c) });
});

mailboxApp.get('/:id{[0-9]+}/bijlage/:n{[0-9]+}', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const n = parseInt(c.req.param('n'), 10);
  const r = await c.env.DB.prepare('SELECT attachments FROM mail_inbox WHERE id = ?').bind(id).first<{ attachments: string }>();
  const att = r ? bijlagen({ attachments: r.attachments } as InboxRow)[n] : undefined;
  if (!att || att.blocked || !att.key) return c.text('Bijlage niet gevonden', 404);
  const obj = c.env.ASSETS_R2 ? await c.env.ASSETS_R2.get(att.key) : null;
  if (!obj) return c.text('Bijlage niet gevonden in opslag', 404);
  const h = new Headers();
  obj.writeHttpMetadata(h);
  // Altijd als download (nooit inline renderen vanaf onze origin).
  h.set('Content-Disposition', `attachment; filename="${att.filename.replace(/"/g, '')}"`);
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(obj.body, { headers: h });
});

mailboxApp.post('/:id{[0-9]+}/antwoord', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const r = await c.env.DB.prepare('SELECT * FROM mail_inbox WHERE id = ?').bind(id).first<InboxRow>();
  if (!r) return redirectErr(c, '/admin/mailbox', 'Mail niet gevonden.');
  const b = await c.req.parseBody();
  const tekst = typeof b.body === 'string' ? b.body.trim() : '';
  if (!tekst) return redirectErr(c, `/admin/mailbox/${id}`, 'Schrijf eerst een antwoord.');
  const settings = await getSettings(c.env.DB);
  const cfg = mailConfig(c.env, settings);
  const alineas = tekst.split(/\n\s*\n/).map((a) => `<p>${a.split('\n').map((x) => esc(x)).join('<br>')}</p>`).join('');
  const onderwerp = /^re:/i.test(r.subject ?? '') ? (r.subject ?? '') : `Re: ${r.subject ?? ''}`;
  const res = await sendEmail(cfg, {
    to: r.from_email,
    subject: onderwerp.slice(0, 200),
    html: emailShell('Reactie van de organisatie', alineas, cfg.brand),
    text: tekst,
    headers: r.message_id ? { 'In-Reply-To': r.message_id, References: r.message_id } : undefined,
  });
  if (!res.ok) return redirectErr(c, `/admin/mailbox/${id}`, `Versturen mislukte: ${res.error ?? 'mail staat uit'}.`);
  await c.env.DB.prepare("UPDATE mail_inbox SET answered_at = unixepoch(), status='afgehandeld' WHERE id = ?").bind(id).run();
  await logAudit(c, 'mailbox.antwoord', 'mail_inbox', String(id));
  return redirectOk(c, `/admin/mailbox/${id}`, 'Antwoord verstuurd.');
});

mailboxApp.post('/:id{[0-9]+}/status', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const b = await c.req.parseBody();
  const status = ['gelezen', 'afgehandeld', 'nieuw'].includes(str(b.status)) ? str(b.status) : 'gelezen';
  await c.env.DB.prepare('UPDATE mail_inbox SET status = ? WHERE id = ?').bind(status, id).run();
  return redirectOk(c, `/admin/mailbox/${id}`, 'Status bijgewerkt.');
});

mailboxApp.post('/:id{[0-9]+}/verwijder', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const r = await c.env.DB.prepare('SELECT attachments FROM mail_inbox WHERE id = ?').bind(id).first<{ attachments: string }>();
  if (r) {
    for (const a of bijlagen({ attachments: r.attachments } as InboxRow)) {
      if (a.key && c.env.ASSETS_R2) await c.env.ASSETS_R2.delete(a.key).catch(() => {});
    }
  }
  await c.env.DB.prepare('DELETE FROM mail_inbox WHERE id = ?').bind(id).run();
  await logAudit(c, 'mailbox.verwijder', 'mail_inbox', String(id));
  return redirectOk(c, '/admin/mailbox', 'Mail verwijderd.');
});
