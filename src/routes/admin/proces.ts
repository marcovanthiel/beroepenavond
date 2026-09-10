/**
 * Procesbeheer (sept 2026): uitnodigingen, mails (templates + outbox +
 * indelingsacties) en het evaluatie-dashboard.
 */
import { Hono } from 'hono';
import type { AdminEnv } from '../../lib/auth';
import { logAudit, randomHex } from '../../lib/auth';
import { renderAdminLayout, esc, pageHeader, flashFromQuery, filterBar, filterEmptyRow } from '../../views/admin/layout';
import { str, redirectOk, redirectErr } from '../../lib/forms';
import { getSettings, getActiveEvent } from '../../lib/db';
import { queueMail, volgende930, getTemplate } from '../../lib/outbox';
import { maakIndeling, studentRooster } from '../../lib/indeling';

const nu = () => Math.floor(Date.now() / 1000);
const dat = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : '-';

function stdPayload(settings: Record<string, string>) {
  return {
    datum: settings['event_date_long'] || 'donderdag 20 november 2026',
    locatie: settings['venue_name'] || 'Canisius College Nijmegen',
  };
}

/** Leesbaar sessierooster van een voorlichter (voor de indelingsmail). */
async function sprekerRooster(db: AdminEnv['Bindings']['DB'], speakerId: string, eventId: string): Promise<string> {
  const rows = await db.prepare(
    `SELECT r.round_no, r.start_time, r.end_time, cl.code AS lokaal, cl.floor AS verdieping
     FROM sessions_program s
     LEFT JOIN rounds r ON r.id = s.round_id
     LEFT JOIN classrooms cl ON cl.id = s.classroom_id
     JOIN speakers sp ON sp.beroep_id = s.beroep_id
     WHERE sp.id = ? AND s.event_id = ? AND s.is_public = 1
     ORDER BY r.round_no`
  ).bind(speakerId, eventId).all<{ round_no: number | null; start_time: string | null; end_time: string | null; lokaal: string | null; verdieping: string | null }>();
  return (rows.results ?? [])
    .filter((r) => r.round_no != null)
    .map((r) => `Ronde ${r.round_no} (${r.start_time ?? '?'} tot ${r.end_time ?? '?'}): lokaal ${r.lokaal ?? 'volgt'}${r.verdieping ? `, ${r.verdieping}` : ''}`)
    .join('\n');
}

// ======================================================================
// Uitnodigingen
// ======================================================================

export const uitnodigingenApp = new Hono<AdminEnv>();

uitnodigingenApp.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT i.*, sp.full_name AS speaker_name FROM speaker_invites i
     LEFT JOIN speakers sp ON sp.id = i.speaker_id ORDER BY i.invited_at DESC`
  ).all<any>();
  const list = (rows.results ?? [])
    .map(
      (r) => `<tr>
      <td><strong>${esc(r.name || r.speaker_name || '-')}</strong><br><span class="muted">${esc(r.email)}</span></td>
      <td>${r.kind === 'herhaal' ? 'Vorig jaar' : 'Nieuw'}</td>
      <td>${r.status === 'aangemeld' ? '<span class="badge badge--on">Aangemeld</span>' : '<span class="badge badge--off">Open</span>'}</td>
      <td>${dat(r.invited_at)}</td>
      <td>${dat(r.reminded_at)}</td>
      <td>${dat(r.responded_at)}</td>
      <td class="actions"><form method="post" action="/admin/uitnodigingen/${esc(r.token)}/verwijder" class="inline-form"><button class="btn btn--ghost btn--sm" data-confirm="Uitnodiging verwijderen?" type="submit">×</button></form></td>
    </tr>`
    )
    .join('');
  const aantalHerhaal = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM speakers WHERE email IS NOT NULL AND email != ''
      AND email NOT IN (SELECT email FROM speaker_invites)`
  ).first<{ n: number }>();
  const body = `
    ${pageHeader('Uitnodigingen voorlichters')}
    <div class="card" style="margin-bottom:18px">
      <h3 style="margin-top:0">Nieuwe voorlichters uitnodigen</h3>
      <form method="post" action="/admin/uitnodigingen/new">
        <label class="fld"><span class="fld__label">E-mailadressen (één per regel, optioneel met naam: <code>Naam &lt;mail@adres.nl&gt;</code>)</span>
        <textarea class="fld__input" name="emails" rows="4" required placeholder="Jan Jansen <jan@bedrijf.nl>&#10;info@praktijk.nl"></textarea></label>
        <p class="muted" style="font-size:.85rem">De uitnodiging wordt de eerstvolgende ochtend om 9:30 verstuurd, met een persoonlijke aanmeldlink. Zonder reactie volgt na een week automatisch één herinnering.</p>
        <button class="btn btn--primary" type="submit">Zet uitnodigingen klaar</button>
      </form>
    </div>
    <div class="card" style="margin-bottom:18px">
      <h3 style="margin-top:0">Voorlichters van vorig jaar</h3>
      <p class="muted">${aantalHerhaal?.n ?? 0} voorlichters met e-mailadres zijn nog niet uitgenodigd. Zij krijgen een "doe je weer mee?"-mail met hun bestaande gegevens ter controle.</p>
      <form method="post" action="/admin/uitnodigingen/herhaal-alle" class="inline-form">
        <button class="btn btn--primary" data-confirm="Uitnodiging klaarzetten voor alle nog niet uitgenodigde voorlichters met e-mailadres?" type="submit">Nodig ze allemaal uit</button>
      </form>
    </div>
    ${filterBar({ targetId: 'inv-tabel', placeholder: 'Zoek op naam of e-mail…', total: (rows.results ?? []).length, noun: 'uitnodigingen' })}
    <div class="table-wrap"><table class="data" id="inv-tabel">
      <thead><tr><th>Wie</th><th>Soort</th><th>Status</th><th>Uitgenodigd</th><th>Herinnerd</th><th>Reactie</th><th></th></tr></thead>
      <tbody>${list || '<tr><td colspan="7" class="empty">Nog geen uitnodigingen.</td></tr>'}${filterEmptyRow(7)}</tbody>
    </table></div>`;
  return renderAdminLayout(c, { title: 'Uitnodigingen', activeKey: 'uitnodigingen', body, flash: flashFromQuery(c) });
});

uitnodigingenApp.post('/new', async (c) => {
  const b = await c.req.parseBody();
  const settings = await getSettings(c.env.DB);
  const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
  const std = stdPayload(settings);
  const regels = str(b.emails).split('\n').map((r) => r.trim()).filter(Boolean);
  let aantal = 0;
  for (const regel of regels.slice(0, 200)) {
    const m = /^(.*?)<([^>]+)>$/.exec(regel);
    const email = (m ? m[2] : regel).trim().toLowerCase();
    const name = (m ? m[1] : '').trim() || null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const token = randomHex(16);
    await c.env.DB.prepare('INSERT INTO speaker_invites (token, email, name, kind) VALUES (?, ?, ?, ?)')
      .bind(token, email, name, 'nieuw').run();
    await queueMail(c.env.DB, {
      templateKey: 'vl_uitnodiging_nieuw', to: email,
      payload: { ...std, naam: name || 'toekomstige voorlichter', link: `${host}/voorlichter/uitnodiging?token=${token}`, knop_label: 'Bekijk de uitnodiging en meld je aan' },
      scheduledFor: volgende930(nu()),
      dedupKey: `uitnodiging:${token}`,
    });
    aantal++;
  }
  await logAudit(c, 'invite.create', 'speaker_invites', String(aantal));
  return redirectOk(c, '/admin/uitnodigingen', `${aantal} uitnodiging(en) klaargezet voor verzending om 9:30.`);
});

uitnodigingenApp.post('/herhaal-alle', async (c) => {
  const settings = await getSettings(c.env.DB);
  const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
  const std = stdPayload(settings);
  const sprekers = await c.env.DB.prepare(
    `SELECT id, full_name, email FROM speakers WHERE email IS NOT NULL AND email != ''
      AND email NOT IN (SELECT email FROM speaker_invites)`
  ).all<{ id: string; full_name: string; email: string }>();
  let aantal = 0;
  for (const sp of sprekers.results ?? []) {
    const token = randomHex(16);
    await c.env.DB.prepare('INSERT INTO speaker_invites (token, email, name, speaker_id, kind) VALUES (?, ?, ?, ?, ?)')
      .bind(token, sp.email.toLowerCase(), sp.full_name, sp.id, 'herhaal').run();
    await queueMail(c.env.DB, {
      templateKey: 'vl_uitnodiging_herhaal', to: sp.email,
      payload: { ...std, naam: sp.full_name, link: `${host}/voorlichter/uitnodiging?token=${token}`, knop_label: 'Bevestig mijn deelname' },
      scheduledFor: volgende930(nu()),
      dedupKey: `uitnodiging:${token}`,
    });
    aantal++;
  }
  await logAudit(c, 'invite.herhaal', 'speaker_invites', String(aantal));
  return redirectOk(c, '/admin/uitnodigingen', `${aantal} herhaal-uitnodiging(en) klaargezet voor 9:30.`);
});

uitnodigingenApp.post('/:token/verwijder', async (c) => {
  const token = c.req.param('token');
  await c.env.DB.prepare("UPDATE mail_outbox SET status='geannuleerd' WHERE dedup_key IN (?, ?) AND status='pending'")
    .bind(`uitnodiging:${token}`, `herinnering:${token}`).run();
  await c.env.DB.prepare('DELETE FROM speaker_invites WHERE token = ?').bind(token).run();
  return redirectOk(c, '/admin/uitnodigingen', 'Uitnodiging verwijderd (geplande mails geannuleerd).');
});

// ======================================================================
// Mails: templates + outbox + indelingsacties
// ======================================================================

export const mailsApp = new Hono<AdminEnv>();

mailsApp.get('/', async (c) => {
  const [tpls, komend, recent, event] = await Promise.all([
    c.env.DB.prepare('SELECT key, name, subject, updated_at FROM mail_templates ORDER BY name').all<any>(),
    c.env.DB.prepare("SELECT * FROM mail_outbox WHERE status='pending' ORDER BY scheduled_for LIMIT 40").all<any>(),
    c.env.DB.prepare("SELECT * FROM mail_outbox WHERE status != 'pending' ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 25").all<any>(),
    getActiveEvent(c.env.DB),
  ]);
  const indeling = event
    ? await c.env.DB.prepare('SELECT COUNT(DISTINCT student_id) AS lln, COUNT(*) AS n FROM student_schedule WHERE event_id = ?').bind(event.id).first<{ lln: number; n: number }>()
    : null;

  const tplRows = (tpls.results ?? [])
    .map((t) => `<tr><td><strong>${esc(t.name)}</strong><br><span class="muted">${esc(t.subject)}</span></td>
      <td>${dat(t.updated_at)}</td>
      <td class="actions"><a class="btn btn--ghost btn--sm" href="/admin/mails/template/${esc(t.key)}">Tekst bewerken</a></td></tr>`)
    .join('');
  const outRow = (r: any) => `<tr><td>${esc(r.to_email)}</td><td>${esc(r.template_key)}</td>
      <td>${dat(r.scheduled_for)}</td><td>${r.status === 'pending' ? '<span class="badge badge--off">Gepland</span>' : r.status === 'sent' ? '<span class="badge badge--on">Verzonden</span>' : `<span class="badge">${esc(r.status)}</span>${r.error ? `<br><span class="muted" style="font-size:.75rem">${esc(String(r.error).slice(0, 80))}</span>` : ''}`}</td>
      <td class="actions">${r.status === 'pending' ? `<form method="post" action="/admin/mails/outbox/${r.id}/annuleer" class="inline-form"><button class="btn btn--ghost btn--sm" type="submit">Annuleer</button></form>` : ''}</td></tr>`;

  const body = `
    ${pageHeader('Mails & verzendingen')}
    <div class="card" style="margin-bottom:18px">
      <h3 style="margin-top:0">Acties</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <form method="post" action="/admin/mails/indeling-voorlichters" class="inline-form"><button class="btn btn--primary" data-confirm="Indelingsmail (rooster + lokaal + praktische info) klaarzetten voor alle bevestigde voorlichters met sessies?" type="submit">Indelingsmails voorlichters</button></form>
        <form method="post" action="/admin/mails/indeling-maken" class="inline-form"><button class="btn btn--primary" data-confirm="Leerling-indeling (opnieuw) maken op basis van voorkeuren, blokkades en lokaalcapaciteit?" type="submit">Maak leerling-indeling</button></form>
        <form method="post" action="/admin/mails/indeling-leerlingen" class="inline-form"><button class="btn btn--primary" data-confirm="Indelingsmail klaarzetten voor alle ingedeelde leerlingen (verzending volgende ochtend 9:30)?" type="submit">Indelingsmails leerlingen</button></form>
      </div>
      <p class="muted" style="margin-top:10px;font-size:.85rem">
        ${indeling && indeling.n ? `Huidige indeling: ${indeling.lln} leerlingen, ${indeling.n} plaatsingen.` : 'Er is nog geen leerling-indeling gemaakt.'}
        Alle procesmails (behalve bevestigingen) verzenden om 9:30; de cron controleert elke 5 minuten.
        Herinneringen, de eventdag-mails en de opvolgmails (10 dagen na afloop) worden automatisch gepland; annuleren kan hieronder zolang ze op "Gepland" staan.
      </p>
    </div>
    <h3>Mailteksten</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Mail</th><th>Laatst gewijzigd</th><th></th></tr></thead>
    <tbody>${tplRows}</tbody></table></div>
    <h3>Geplande verzendingen (${(komend.results ?? []).length})</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Aan</th><th>Mail</th><th>Verzendmoment</th><th>Status</th><th></th></tr></thead>
    <tbody>${(komend.results ?? []).map(outRow).join('') || '<tr><td colspan="5" class="empty">Niets gepland.</td></tr>'}</tbody></table></div>
    <h3>Recent verzonden</h3>
    <div class="table-wrap"><table class="data"><thead><tr><th>Aan</th><th>Mail</th><th>Moment</th><th>Status</th><th></th></tr></thead>
    <tbody>${(recent.results ?? []).map(outRow).join('') || '<tr><td colspan="5" class="empty">Nog niets verzonden.</td></tr>'}</tbody></table></div>`;
  return renderAdminLayout(c, { title: 'Mails', activeKey: 'mails', body, flash: flashFromQuery(c) });
});

mailsApp.get('/template/:key', async (c) => {
  const tpl = await getTemplate(c.env.DB, c.req.param('key'));
  if (!tpl) return redirectErr(c, '/admin/mails', 'Onbekende mailtekst.');
  const body = `
    ${pageHeader(esc(tpl.name))}
    <form method="post" action="/admin/mails/template/${esc(tpl.key)}" class="card">
      <label class="fld"><span class="fld__label">Onderwerp</span>
        <input class="fld__input" type="text" name="subject" value="${esc(tpl.subject)}" required></label>
      <label class="fld"><span class="fld__label">Tekst</span>
        <textarea class="fld__input" name="body" rows="16" required>${esc(tpl.body)}</textarea>
        <span class="fld__help">Losse alinea's scheiden met een lege regel. Beschikbare invulvelden:
        {{naam}} {{voornaam}} {{datum}} {{locatie}} {{rooster}} {{stats}} en {{knop}} (wordt de zwarte knop).
        **vetgedrukt** kan met dubbele sterretjes.</span></label>
      <div class="form-actions"><button class="btn btn--primary" type="submit">Opslaan</button>
      <a class="btn btn--ghost" href="/admin/mails">Terug</a></div>
    </form>`;
  return renderAdminLayout(c, { title: tpl.name, activeKey: 'mails', body, flash: flashFromQuery(c) });
});

mailsApp.post('/template/:key', async (c) => {
  const key = c.req.param('key');
  const b = await c.req.parseBody();
  const subject = str(b.subject);
  const bodyTekst = typeof b.body === 'string' ? b.body : '';
  if (!subject || !bodyTekst.trim()) return redirectErr(c, `/admin/mails/template/${key}`, 'Onderwerp en tekst zijn verplicht.');
  await c.env.DB.prepare('UPDATE mail_templates SET subject = ?, body = ?, updated_at = ? WHERE key = ?')
    .bind(subject, bodyTekst, nu(), key).run();
  await logAudit(c, 'mailtemplate.update', 'mail_templates', key);
  return redirectOk(c, '/admin/mails', 'Mailtekst opgeslagen. Geplande mails gebruiken automatisch de nieuwe tekst.');
});

mailsApp.post('/outbox/:id/annuleer', async (c) => {
  await c.env.DB.prepare("UPDATE mail_outbox SET status='geannuleerd' WHERE id = ? AND status='pending'")
    .bind(parseInt(c.req.param('id'), 10) || 0).run();
  return redirectOk(c, '/admin/mails', 'Geplande mail geannuleerd.');
});

mailsApp.post('/indeling-voorlichters', async (c) => {
  const [settings, event] = await Promise.all([getSettings(c.env.DB), getActiveEvent(c.env.DB)]);
  if (!event) return redirectErr(c, '/admin/mails', 'Geen actieve editie.');
  const std = stdPayload(settings);
  const sprekers = await c.env.DB.prepare(
    "SELECT id, full_name, email FROM speakers WHERE confirmed = 1 AND email IS NOT NULL AND email != ''"
  ).all<{ id: string; full_name: string; email: string }>();
  let aantal = 0;
  for (const sp of sprekers.results ?? []) {
    const rooster = await sprekerRooster(c.env.DB, sp.id, event.id);
    if (!rooster) continue;
    await queueMail(c.env.DB, {
      templateKey: 'vl_indeling', to: sp.email,
      payload: { ...std, naam: sp.full_name, rooster },
      scheduledFor: volgende930(nu()),
      dedupKey: `vl_indeling:${event.id}:${sp.id}`,
    });
    aantal++;
  }
  await logAudit(c, 'mail.indeling_vl', 'mail_outbox', String(aantal));
  return redirectOk(c, '/admin/mails', `${aantal} indelingsmail(s) klaargezet voor 9:30 (voorlichters zonder sessies overgeslagen).`);
});

mailsApp.post('/indeling-maken', async (c) => {
  const event = await getActiveEvent(c.env.DB);
  if (!event) return redirectErr(c, '/admin/mails', 'Geen actieve editie.');
  const r = await maakIndeling(c.env.DB, event.id);
  await logAudit(c, 'indeling.maken', 'student_schedule', `${r.plaatsingen}`);
  return redirectOk(
    c, '/admin/mails',
    `Indeling gemaakt: ${r.leerlingen} leerlingen, ${r.plaatsingen} plaatsingen, ${r.onvervuldeWensen} wensen niet inpasbaar, ${r.zonderEnkelePlek} leerling(en) zonder plek.`
  );
});

mailsApp.post('/indeling-leerlingen', async (c) => {
  const [settings, event] = await Promise.all([getSettings(c.env.DB), getActiveEvent(c.env.DB)]);
  if (!event) return redirectErr(c, '/admin/mails', 'Geen actieve editie.');
  const std = stdPayload(settings);
  const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
  const lln = await c.env.DB.prepare(
    'SELECT DISTINCT s.id, s.email, s.name FROM students s JOIN student_schedule ss ON ss.student_id = s.id AND ss.event_id = ?'
  ).bind(event.id).all<{ id: string; email: string; name: string | null }>();
  let aantal = 0;
  for (const l of lln.results ?? []) {
    const rooster = await studentRooster(c.env.DB, l.id, event.id);
    if (!rooster.length) continue;
    const tekst = rooster.map((r) => `Ronde ${r.ronde ?? '?'} (${r.tijd}): ${r.beroep}, lokaal ${r.lokaal}`).join('\n');
    await queueMail(c.env.DB, {
      templateKey: 'll_indeling', to: l.email,
      payload: { ...std, voornaam: (l.name || 'daar').split(' ')[0], rooster: tekst, link: `${host}/leerling`, knop_label: 'Bekijk je rooster in Mijn avond' },
      scheduledFor: volgende930(nu()),
      dedupKey: `ll_indeling:${event.id}:${l.id}`,
    });
    aantal++;
  }
  await logAudit(c, 'mail.indeling_ll', 'mail_outbox', String(aantal));
  return redirectOk(c, '/admin/mails', `${aantal} leerling-indelingsmail(s) klaargezet voor 9:30 (volgende ochtend).`);
});

// ======================================================================
// Evaluaties (dashboard + CSV)
// ======================================================================

export const evaluatiesApp = new Hono<AdminEnv>();

interface EvalRow {
  id: number; speaker_id: string; total_participants: number | null;
  questions: string | null; remarks: string | null; again: string | null; created_at: number;
  full_name: string; job_title: string | null; cat_name: string | null;
}

async function evalData(db: AdminEnv['Bindings']['DB'], eventId: string): Promise<EvalRow[]> {
  const rows = await db.prepare(
    `SELECT e.id, e.speaker_id, e.total_participants, e.questions, e.remarks, e.again, e.created_at,
            sp.full_name, sp.job_title, cat.name AS cat_name
     FROM speaker_evaluations e
     JOIN speakers sp ON sp.id = e.speaker_id
     LEFT JOIN beroepen b ON b.id = sp.beroep_id
     LEFT JOIN categories cat ON cat.id = b.category_id
     WHERE e.event_id = ? ORDER BY e.created_at DESC`
  ).bind(eventId).all<EvalRow>();
  return rows.results ?? [];
}

evaluatiesApp.get('/', async (c) => {
  const event = await getActiveEvent(c.env.DB);
  if (!event) return renderAdminLayout(c, { title: 'Evaluaties', activeKey: 'evaluaties', body: pageHeader('Evaluaties') + '<p>Geen actieve editie.</p>' });
  const [evals, gemaild] = await Promise.all([
    evalData(c.env.DB, event.id),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM speaker_eval_tokens WHERE event_id = ?').bind(event.id).first<{ n: number }>(),
  ]);
  const totDeelnemers = evals.reduce((a, e) => a + (e.total_participants ?? 0), 0);
  const weer = { ja: 0, misschien: 0, nee: 0 } as Record<string, number>;
  for (const e of evals) weer[e.again ?? 'misschien'] = (weer[e.again ?? 'misschien'] ?? 0) + 1;
  const rows = evals
    .map(
      (e) => `<tr>
      <td><strong>${esc(e.full_name)}</strong><br><span class="muted">${esc(e.job_title ?? '')}</span></td>
      <td>${esc(e.cat_name ?? '-')}</td>
      <td style="text-align:right">${e.total_participants ?? '-'}</td>
      <td>${e.again === 'ja' ? '<span class="badge badge--on">Ja</span>' : e.again === 'nee' ? '<span class="badge badge--off">Nee</span>' : 'Misschien'}</td>
      <td style="max-width:260px">${e.questions ? `<div class="muted" style="font-size:.82rem"><strong>Vragen:</strong> ${esc(e.questions.slice(0, 140))}${e.questions.length > 140 ? '…' : ''}</div>` : ''}
        ${e.remarks ? `<div class="muted" style="font-size:.82rem"><strong>Tips:</strong> ${esc(e.remarks.slice(0, 140))}${e.remarks.length > 140 ? '…' : ''}</div>` : ''}</td>
      <td>${dat(e.created_at)}</td>
    </tr>`
    )
    .join('');
  const body = `
    ${pageHeader('Evaluaties', `<a class="btn btn--primary" href="/admin/evaluaties/export.csv">Download CSV (volledig rapport)</a>`)}
    <div class="stat-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px">
      <div class="card"><strong style="font-size:1.6rem">${evals.length}</strong><br><span class="muted">ingevuld van ${gemaild?.n ?? 0} gemaild</span></div>
      <div class="card"><strong style="font-size:1.6rem">${totDeelnemers}</strong><br><span class="muted">deelnemers geteld</span></div>
      <div class="card"><strong style="font-size:1.6rem">${weer.ja}</strong><br><span class="muted">doen volgend jaar weer mee</span></div>
      <div class="card"><strong style="font-size:1.6rem">${weer.misschien} / ${weer.nee}</strong><br><span class="muted">misschien / nee</span></div>
    </div>
    ${filterBar({ targetId: 'eval-tabel', placeholder: 'Filter op naam, beroep of categorie…', total: evals.length, noun: 'evaluaties' })}
    <div class="table-wrap"><table class="data" id="eval-tabel">
      <thead><tr><th>Voorlichter</th><th>Categorie</th><th>Deelnemers</th><th>Volgend jaar?</th><th>Vragen & tips</th><th>Ingevuld</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty">Nog geen evaluaties ontvangen.</td></tr>'}${filterEmptyRow(6)}</tbody>
    </table></div>
    <p class="muted" style="margin-top:12px;font-size:.85rem">Flexibel rapporteren: filter hierboven en gebruik de CSV voor eigen draaitabellen (alle velden, incl. aantallen per sessie en volledige teksten).</p>`;
  return renderAdminLayout(c, { title: 'Evaluaties', activeKey: 'evaluaties', body, flash: flashFromQuery(c) });
});

evaluatiesApp.get('/export.csv', async (c) => {
  const event = await getActiveEvent(c.env.DB);
  if (!event) return c.text('geen actieve editie', 404);
  const evals = await evalData(c.env.DB, event.id);
  const kop = ['voorlichter', 'beroep', 'categorie', 'deelnemers_totaal', 'volgend_jaar', 'vragen', 'opmerkingen', 'ingevuld_op'];
  const csvEsc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const regels = evals.map((e) =>
    [e.full_name, e.job_title ?? '', e.cat_name ?? '', e.total_participants ?? '', e.again ?? '',
     e.questions ?? '', e.remarks ?? '', new Date(e.created_at * 1000).toISOString()].map(csvEsc).join(';')
  );
  const bom = '﻿';
  return new Response(bom + kop.join(';') + '\n' + regels.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="evaluaties-${event.year}.csv"`,
    },
  });
});
