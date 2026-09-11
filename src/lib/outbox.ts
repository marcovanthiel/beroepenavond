/**
 * Mail-outbox + planner (procesinrichting sept 2026).
 *
 * Principe: mails worden niet direct verstuurd maar in `mail_outbox`
 * klaargezet met een verzendmoment. De cron (elke 5 min) verstuurt wat
 * "due" is. Niet-bevestigingsmails plannen we op de eerstvolgende 9:30
 * (Europa/Amsterdam); bevestigingsmails gaan buiten de outbox om direct.
 *
 * Teksten komen uit `mail_templates` (bewerkbaar in beheer → Mails) met
 * placeholders; {{knop}} rendert de zwarte huisstijlknop.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { Env, SettingsMap } from '../env';
import { getSettings, getActiveEvent } from './db';
import { mailConfig, sendEmail, emailShell, emailButton, type MailConfig } from './email';

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------
// Tijd (Europa/Amsterdam)
// ---------------------------------------------------------------------

/** Ruwe DST-benadering: apr t/m okt = UTC+2, anders UTC+1. (Exact genoeg:
 *  rond de omschakeldagen scheelt het hooguit één uur op de verzendtijd.) */
export function amsterdamOffsetHours(d: Date): number {
  const m = d.getUTCMonth() + 1;
  return m >= 4 && m <= 10 ? 2 : 1;
}

/** Unix-tijd van de eerstvolgende 9:30 (Amsterdam), vanaf `vanaf` (unix). */
export function volgende930(vanaf: number): number {
  const d = new Date(vanaf * 1000);
  const off = amsterdamOffsetHours(d);
  const lokaal = new Date(d.getTime() + off * 3600_000);
  const doel = Date.UTC(lokaal.getUTCFullYear(), lokaal.getUTCMonth(), lokaal.getUTCDate(), 9, 30) - off * 3600_000;
  return doel / 1000 > vanaf ? doel / 1000 : doel / 1000 + 86400;
}

/** Datum (YYYY-MM-DD) in Amsterdamse tijd. */
export function amsterdamDatum(unix: number): string {
  const d = new Date((unix + amsterdamOffsetHours(new Date(unix * 1000)) * 3600) * 1000);
  return d.toISOString().slice(0, 10);
}

/** Minuten sinds middernacht (Amsterdam). */
function amsterdamMinuten(unix: number): number {
  const d = new Date((unix + amsterdamOffsetHours(new Date(unix * 1000)) * 3600) * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// ---------------------------------------------------------------------
// Templates + rendering
// ---------------------------------------------------------------------

export interface MailTemplate { key: string; name: string; subject: string; body: string; }

export async function getTemplate(db: D1Database, key: string): Promise<MailTemplate | null> {
  return (await db.prepare('SELECT key, name, subject, body FROM mail_templates WHERE key = ?').bind(key).first<MailTemplate>()) ?? null;
}

export type MailPayload = Record<string, string> & { link?: string; knop_label?: string };

/** Vult placeholders in en rendert de body naar huisstijl-HTML. */
export function renderTemplate(
  tpl: MailTemplate,
  payload: MailPayload
): { subject: string; html: (cfg: MailConfig) => string; text: string } {
  const vul = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_m, k) => payload[k] ?? '');
  const subject = vul(tpl.subject);
  const bodyText = vul(tpl.body.replace(/\{\{knop\}\}/g, payload.link ?? ''));
  const alineas = tpl.body
    .split(/\n\s*\n/)
    .map((blokRuw) => {
      // {{knop}} detecteren op de RUWE tekst (vul() zou hem leegmaken).
      if (blokRuw.includes('{{knop}}')) {
        return payload.link ? `<p style="margin:18px 0">${emailButton(payload.link, payload.knop_label || 'Open de pagina')}</p>` : '';
      }
      const gevuld = vul(blokRuw).trim();
      if (!gevuld) return ''; // leeg geworden blok (bv. {{vragen}} zonder vragen) overslaan
      const regels = gevuld
        .split('\n')
        .map((r) => esc(r).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))
        .join('<br>');
      return `<p>${regels}</p>`;
    })
    .filter(Boolean)
    .join('');
  return { subject, html: (cfg) => emailShell(tpl.name.split(':')[1]?.trim() || tpl.name, alineas, cfg.brand), text: bodyText };
}

// ---------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------

export async function queueMail(
  db: D1Database,
  args: { templateKey: string; to: string; payload: MailPayload; scheduledFor: number; dedupKey?: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO mail_outbox (dedup_key, template_key, to_email, payload, scheduled_for)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(args.dedupKey ?? null, args.templateKey, args.to, JSON.stringify(args.payload), args.scheduledFor)
    .run();
}

/** Verstuurt due outbox-items (max `limit` per run). */
export async function processOutbox(env: Env, limit = 40): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const due = await env.DB.prepare(
    `SELECT id, template_key, to_email, payload FROM mail_outbox
     WHERE status = 'pending' AND scheduled_for <= ? ORDER BY scheduled_for LIMIT ?`
  ).bind(now, limit).all<{ id: number; template_key: string; to_email: string; payload: string }>();
  const items = due.results ?? [];
  if (!items.length) return 0;
  const settings = await getSettings(env.DB);
  const cfg = mailConfig(env, settings);
  let verzonden = 0;
  for (const it of items) {
    const tpl = await getTemplate(env.DB, it.template_key);
    if (!tpl) {
      await env.DB.prepare("UPDATE mail_outbox SET status='failed', error='template onbekend' WHERE id=?").bind(it.id).run();
      continue;
    }
    let payload: MailPayload = {};
    try { payload = JSON.parse(it.payload); } catch { /* leeg */ }
    const r = renderTemplate(tpl, payload);
    const res = await sendEmail(cfg, { to: it.to_email, subject: r.subject, html: r.html(cfg), text: r.text });
    if (res.ok) {
      await env.DB.prepare("UPDATE mail_outbox SET status='sent', sent_at=? WHERE id=?").bind(now, it.id).run();
      verzonden++;
    } else if (res.skipped) {
      await env.DB.prepare("UPDATE mail_outbox SET status='failed', error='mail uitgeschakeld of key ontbreekt' WHERE id=?").bind(it.id).run();
    } else {
      await env.DB.prepare("UPDATE mail_outbox SET status='failed', error=? WHERE id=?").bind(res.error ?? 'onbekend', it.id).run();
    }
  }
  return verzonden;
}

// ---------------------------------------------------------------------
// Planner (idempotent via dedup-keys; draait elke cron-tick)
// ---------------------------------------------------------------------

function stdPayload(settings: SettingsMap): MailPayload {
  return {
    datum: settings['event_date_long'] || 'donderdag 20 november 2026',
    locatie: settings['venue_name'] || 'Montessori College Nijmegen',
  };
}

/** Datum (YYYY-MM-DD) van `iso` plus/minus dagen. */
function datumPlus(iso: string, dagen: number): string {
  const t = Date.parse(iso + 'T12:00:00Z');
  if (!Number.isFinite(t)) return iso;
  return new Date(t + dagen * 86400000).toISOString().slice(0, 10);
}

/** Ontdubbelt vragen (hoofdletter/spatie-ongevoelig), behoudt de eerste vorm. */
function ontdubbel(vragen: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vragen) {
    const q = v.trim();
    if (!q) continue;
    const k = q.toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

/** Bouwt de vragen-tekst voor in de mail: opsomming, of AI-samenvatting bij
 *  veel vragen (alleen als er een Anthropic-key is; anders nette terugval). */
async function vragenTekst(env: Env, beroepNaam: string, vragen: string[]): Promise<string> {
  const uniek = ontdubbel(vragen);
  if (!uniek.length) return '';
  const lijst = uniek.map((v) => '- ' + v).join('\n');
  if (uniek.length <= 10 || !env.ANTHROPIC_API_KEY) return lijst;
  try {
    const prompt =
      `Hieronder staan vragen die scholieren vooraf stelden aan een voorlichter (beroep: ${beroepNaam}). ` +
      `Vat ze samen tot een beknopte, gegroepeerde lijst met streepjes-bullets in het Nederlands: voeg vergelijkbare vragen samen, haal dubbele eruit, behoud de kern. ` +
      `Geef ALLEEN de bullets, geen inleiding.\n\n${uniek.map((v) => '- ' + v).join('\n')}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return lijst;
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    const txt = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
    return txt || lijst;
  } catch {
    return lijst;
  }
}

/** Openstaande (nog niet verstuurde) vragen voor een beroep + hun ids. */
async function openVragen(db: D1Database, beroepId: number): Promise<{ ids: number[]; teksten: string[] }> {
  const rows = await db
    .prepare('SELECT id, question FROM student_questions WHERE beroep_id = ? AND sent_to_speaker = 0 ORDER BY created_at')
    .bind(beroepId)
    .all<{ id: number; question: string }>();
  const r = rows.results ?? [];
  return { ids: r.map((x) => x.id), teksten: r.map((x) => x.question) };
}

async function markVragenVerstuurd(db: D1Database, ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    await db.prepare(`UPDATE student_questions SET sent_to_speaker = 1 WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).run();
  }
}

/** Is er al een (welk dan ook) outbox-item met deze dedup-key? */
async function bestaatOutbox(db: D1Database, dedupKey: string): Promise<boolean> {
  const r = await db.prepare('SELECT 1 FROM mail_outbox WHERE dedup_key = ? LIMIT 1').bind(dedupKey).first();
  return !!r;
}

export async function plannerTick(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const db = env.DB;
  const [settings, event] = await Promise.all([getSettings(db), getActiveEvent(db)]);
  if (!event) return;
  const host = `https://${settings['site_host'] || 'inijmegen.com'}`;
  const std = stdPayload(settings);
  const vandaag = amsterdamDatum(now);

  // 1. Herinnering: open uitnodigingen ouder dan 7 dagen, nog niet herinnerd.
  const teHerinneren = await db.prepare(
    `SELECT token, email, name FROM speaker_invites
     WHERE status = 'open' AND reminded_at IS NULL AND invited_at < ?`
  ).bind(now - 7 * 86400).all<{ token: string; email: string; name: string | null }>();
  for (const inv of teHerinneren.results ?? []) {
    await queueMail(db, {
      templateKey: 'vl_herinnering',
      to: inv.email,
      payload: { ...std, naam: inv.name || 'voorlichter', link: `${host}/voorlichter/uitnodiging?token=${inv.token}`, knop_label: 'Bekijk de uitnodiging' },
      scheduledFor: volgende930(now),
      dedupKey: `herinnering:${inv.token}`,
    });
    await db.prepare('UPDATE speaker_invites SET reminded_at = ? WHERE token = ?').bind(now, inv.token).run();
  }

  // 2a. Twee dagen vóór het event: vragen-vooraf per beroep naar de
  //     bevestigde voorlichters (9:30). Voorlichters zonder vragen overslaan.
  if (datumPlus(event.date, -2) === vandaag) {
    const sprekers = await db.prepare(
      `SELECT sp.id, sp.full_name, sp.email, sp.beroep_id, b.name AS beroep
       FROM speakers sp LEFT JOIN beroepen b ON b.id = sp.beroep_id
       WHERE sp.is_public = 1 AND sp.confirmed = 1 AND sp.email IS NOT NULL AND sp.email != '' AND sp.beroep_id IS NOT NULL`
    ).all<{ id: string; full_name: string; email: string; beroep_id: number; beroep: string | null }>();
    for (const s of sprekers.results ?? []) {
      const dedup = `vl_vragen:${event.id}:${s.id}`;
      if (await bestaatOutbox(db, dedup)) continue;
      const { ids, teksten } = await openVragen(db, s.beroep_id);
      if (!ids.length) continue; // geen vragen → geen mail, later evt. alsnog
      const vragen = await vragenTekst(env, s.beroep || 'dit beroep', teksten);
      await queueMail(db, {
        templateKey: 'vl_vragen', to: s.email,
        payload: { ...std, naam: s.full_name, vragen },
        scheduledFor: volgende930(now),
        dedupKey: dedup,
      });
      await markVragenVerstuurd(db, ids);
    }
  }

  // 2b. Ochtend van het event: opsteker voor bevestigde voorlichters (9:30),
  //     met de vragen die ná de vragen-mail nog zijn binnengekomen.
  if (vandaag === event.date) {
    const sprekers = await db.prepare(
      `SELECT sp.id, sp.full_name, sp.email, sp.beroep_id, b.name AS beroep
       FROM speakers sp LEFT JOIN beroepen b ON b.id = sp.beroep_id
       WHERE sp.is_public = 1 AND sp.confirmed = 1 AND sp.email IS NOT NULL AND sp.email != ''`
    ).all<{ id: string; full_name: string; email: string; beroep_id: number | null; beroep: string | null }>();
    for (const s of sprekers.results ?? []) {
      const dedup = `vl_eventdag:${event.id}:${s.id}`;
      if (await bestaatOutbox(db, dedup)) continue;
      let vragenBlok = '';
      let laatIds: number[] = [];
      if (s.beroep_id) {
        const { ids, teksten } = await openVragen(db, s.beroep_id);
        if (ids.length) {
          laatIds = ids;
          const vragen = await vragenTekst(env, s.beroep || 'dit beroep', teksten);
          vragenBlok = 'Nog enkele vragen die sinds ons vorige berichtje binnenkwamen:\n' + vragen;
        }
      }
      await queueMail(db, {
        templateKey: 'vl_eventdag', to: s.email,
        payload: { ...std, naam: s.full_name, vragen: vragenBlok },
        scheduledFor: volgende930(now - 86400) <= now ? now : volgende930(now),
        dedupKey: dedup,
      });
      if (laatIds.length) await markVragenVerstuurd(db, laatIds);
    }
  }

  // 3. Dag vóór het event: leerlingen enthousiasmeren (9:30).
  const morgen = amsterdamDatum(now + 86400);
  if (morgen === event.date) {
    const lln = await db.prepare('SELECT id, email, name FROM students').all<{ id: string; email: string; name: string | null }>();
    for (const l of lln.results ?? []) {
      await queueMail(db, {
        templateKey: 'll_eventdag', to: l.email,
        payload: { ...std, voornaam: (l.name || 'daar').split(' ')[0] },
        scheduledFor: volgende930(now - 86400) <= now ? now : volgende930(now),
        dedupKey: `ll_eventdag:${event.id}:${l.id}`,
      });
    }
  }

  // 4. Evaluatie: op de avond zelf, zodra de eerste sessie van een spreker
  //    begonnen is (direct versturen, niet 9:30 — expliciete proceskeuze).
  if (vandaag === event.date && amsterdamMinuten(now) >= 17 * 60) {
    const rows = await db.prepare(
      `SELECT sp.id, sp.full_name, sp.email, MIN(r.start_time) AS eerste
       FROM speakers sp
       JOIN sessions_program s ON s.beroep_id = sp.beroep_id AND s.event_id = ?
       JOIN rounds r ON r.id = s.round_id
       WHERE sp.confirmed = 1 AND sp.email IS NOT NULL AND sp.email != ''
       GROUP BY sp.id`
    ).bind(event.id).all<{ id: string; full_name: string; email: string; eerste: string | null }>();
    const minuten = amsterdamMinuten(now);
    for (const s of rows.results ?? []) {
      if (!s.eerste) continue;
      const [hh, mm] = s.eerste.split(':').map((x) => parseInt(x, 10));
      if (!Number.isFinite(hh) || minuten < hh * 60 + (mm || 0)) continue;
      const token = crypto.randomUUID().replace(/-/g, '');
      const ins = await db.prepare('INSERT OR IGNORE INTO speaker_eval_tokens (token, speaker_id, event_id) VALUES (?, ?, ?)')
        .bind(token, s.id, event.id).run();
      if (!ins.meta.changes) continue; // al gemaild
      await queueMail(db, {
        templateKey: 'vl_evaluatie', to: s.email,
        payload: { ...std, naam: s.full_name, link: `${host}/evaluatie?token=${token}`, knop_label: 'Vul de evaluatie in' },
        scheduledFor: now,
        dedupKey: `vl_evaluatie:${event.id}:${s.id}`,
      });
    }
  }

  // 5. Opvolgmails: 10 dagen na het event om 9:30 (teksten vooraf aan te
  //    passen in beheer → Mails; items zijn tot verzending te annuleren).
  const eventUnix = Date.parse(`${event.date}T12:00:00Z`) / 1000;
  if (Number.isFinite(eventUnix) && now > eventUnix + 8 * 86400 && now < eventUnix + 30 * 86400) {
    const verzendMoment = volgende930(Math.max(now, eventUnix + 9 * 86400));
    const [aantalLln, aantalPicks, sprekers2, lln2] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM students').first<{ n: number }>(),
      db.prepare('SELECT COUNT(*) AS n FROM student_schedule WHERE event_id = ?').bind(event.id).first<{ n: number }>(),
      db.prepare("SELECT id, full_name, email FROM speakers WHERE confirmed = 1 AND email IS NOT NULL AND email != ''").all<{ id: string; full_name: string; email: string }>(),
      db.prepare('SELECT id, email, name FROM students').all<{ id: string; email: string; name: string | null }>(),
    ]);
    const stats = `Een paar cijfers: ${aantalLln?.n ?? 0} leerlingen maakten een eigen avondprogramma en samen bezochten ze ${aantalPicks?.n ?? 0} sessies.`;
    for (const s of sprekers2.results ?? []) {
      await queueMail(db, {
        templateKey: 'vl_bedankt', to: s.email,
        payload: { ...std, naam: s.full_name, stats },
        scheduledFor: verzendMoment,
        dedupKey: `vl_bedankt:${event.id}:${s.id}`,
      });
    }
    for (const l of lln2.results ?? []) {
      await queueMail(db, {
        templateKey: 'll_bedankt', to: l.email,
        payload: { ...std, voornaam: (l.name || 'daar').split(' ')[0], stats },
        scheduledFor: verzendMoment,
        dedupKey: `ll_bedankt:${event.id}:${l.id}`,
      });
    }
  }
}
