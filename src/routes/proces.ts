/**
 * Publieke procespagina's (sept 2026):
 *  - /voorlichter/uitnodiging?token=…  aanmelden/bevestigen op uitnodiging
 *  - /evaluatie?token=…                evaluatieformulier na de avond
 * Beide zijn token-gebaseerd (geen login nodig) en tonen na inzenden een
 * duidelijke bevestiging. Bevestigingsmails gaan direct (niet via 9:30).
 */
import { Hono } from 'hono';
import type { Env } from '../env';
import { getNavPages, getSettings, getActiveEvent } from '../lib/db';
import { renderLayout } from '../views/layout';
import { renderError } from '../views/public';
import { mailConfig, speakerConfirmedMail, sendEmail, emailShell } from '../lib/email';
import { randomHex } from '../lib/auth';

export const procesApp = new Hono<{ Bindings: Env }>();

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface InviteRow {
  token: string; email: string; name: string | null; speaker_id: string | null;
  kind: string; status: string;
}

async function getInvite(db: Env['DB'], token: string): Promise<InviteRow | null> {
  if (!token) return null;
  return (await db.prepare('SELECT * FROM speaker_invites WHERE token = ?').bind(token).first<InviteRow>()) ?? null;
}

function veld(label: string, name: string, value: string, opts?: { type?: string; required?: boolean; hint?: string }): string {
  return `<div class="field"><label for="f-${name}">${esc(label)}${opts?.required ? ' <span class="req">*</span>' : ''}</label>
    <input id="f-${name}" type="${opts?.type ?? 'text'}" name="${name}" value="${esc(value)}"${opts?.required ? ' required' : ''}>
    ${opts?.hint ? `<small>${esc(opts.hint)}</small>` : ''}</div>`;
}

// ----------------------------------------------------------------------
// Uitnodiging (proces 1 + 2 + sponsor-optie 3)
// ----------------------------------------------------------------------

procesApp.get('/voorlichter/uitnodiging', async (c) => {
  const inv = await getInvite(c.env.DB, c.req.query('token') ?? '');
  const [settings, navItems] = await Promise.all([getSettings(c.env.DB), getNavPages(c.env.DB)]);
  if (!inv) {
    return renderError(c, 404, 'Deze uitnodigingslink is niet (meer) geldig. Neem contact op met de organisatie.');
  }

  if (c.req.query('klaar') || inv.status === 'aangemeld') {
    return c.html(renderLayout({
      title: 'Aanmelding ontvangen — Beroepenavond Nijmegen',
      metaDescription: null, navItems, activeSlug: '',
      hero: { eyebrow: 'Voorlichter', title: 'Dank, je staat genoteerd!', compact: true },
      bodyHtml: `<p class="lede">We hebben je gegevens ontvangen en sturen je een bevestiging per e-mail.
        Richting ${esc(settings['event_date_long'] || 'de avond')} hoor je van ons over je indeling (tijden en lokaal).</p>
        <p><a class="btn btn--primary" href="/">Naar de site</a></p>`,
      settings,
    }));
  }

  // Herhaal-uitnodiging: gegevens van vorig jaar voor-invullen ter controle.
  let sp: { full_name?: string; email?: string; phone?: string; organization?: string; job_title?: string; linkedin?: string } = {};
  if (inv.speaker_id) {
    sp = (await c.env.DB.prepare('SELECT full_name, email, phone, organization, job_title, linkedin FROM speakers WHERE id = ?')
      .bind(inv.speaker_id).first()) ?? {};
  }
  const herhaal = inv.kind === 'herhaal';
  const intro = herhaal
    ? `Fijn dat je er (hopelijk) weer bij bent! Controleer hieronder of je gegevens nog kloppen, pas aan wat gewijzigd is en bevestig je deelname.`
    : `Leuk dat je meedoet! Vul hieronder je gegevens in; wij regelen de rest en houden je op de hoogte van je indeling.`;

  const body = `
    <p class="lede">${intro}</p>
    <form class="form card-box" method="post" action="/voorlichter/uitnodiging?token=${esc(inv.token)}">
      <div class="form__row cols-2">
        ${veld('Naam', 'name', sp.full_name ?? inv.name ?? '', { required: true })}
        ${veld('E-mail', 'email', sp.email ?? inv.email, { type: 'email', required: true })}
        ${veld('Telefoon', 'phone', sp.phone ?? '')}
        ${veld('Organisatie / werkgever', 'organization', sp.organization ?? '')}
      </div>
      ${veld('Beroep dat je presenteert', 'job_title', sp.job_title ?? '', { required: true, hint: 'Bijv. architect, IC-verpleegkundige, piloot' })}
      ${veld('LinkedIn (optioneel)', 'linkedin', sp.linkedin ?? '', { hint: 'Wordt bij je naam op de site getoond' })}
      <div class="field"><label style="display:flex;gap:10px;align-items:flex-start;font-weight:500">
        <input type="checkbox" name="sponsor" value="1" style="width:auto;margin-top:4px">
        <span><strong>Ik heb interesse om sponsor te worden.</strong><br>
        <small>Je logo komt dan op de website en we maken er extra reclame mee. De organisatie neemt contact op over de mogelijkheden.</small></span>
      </label></div>
      <div class="form__actions">
        <button type="submit" class="btn btn--primary btn--lg">${herhaal ? 'Bevestig mijn deelname' : 'Meld mij aan als voorlichter'}</button>
      </div>
      <p class="form-consent">Je contactgegevens zijn alleen voor de organisatie zichtbaar. Zie ons <a href="/privacy">privacybeleid</a>.</p>
    </form>`;

  return c.html(renderLayout({
    title: `${herhaal ? 'Doe je weer mee?' : 'Word voorlichter'} — Beroepenavond Nijmegen`,
    metaDescription: null, navItems, activeSlug: '',
    hero: {
      eyebrow: settings['event_date_long'] || 'Beroepenavond',
      title: herhaal ? 'Doe je dit jaar weer mee?' : 'Word voorlichter',
      compact: true,
    },
    bodyHtml: body,
    settings,
  }));
});

procesApp.post('/voorlichter/uitnodiging', async (c) => {
  const inv = await getInvite(c.env.DB, c.req.query('token') ?? '');
  if (!inv) return renderError(c, 404, 'Deze uitnodigingslink is niet (meer) geldig.');
  const b = await c.req.parseBody();
  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const jobTitle = str(b.job_title);
  if (!name || !EMAIL_RE.test(email) || !jobTitle) {
    return c.redirect(`/voorlichter/uitnodiging?token=${inv.token}`, 302);
  }
  const sponsor = str(b.sponsor) ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);
  let speakerId = inv.speaker_id;
  if (speakerId) {
    await c.env.DB.prepare(
      `UPDATE speakers SET full_name=?, email=?, phone=?, organization=?, job_title=?, linkedin=?,
        sponsor_interest=?, confirmed=1, updated_at=? WHERE id=?`
    ).bind(name, email, str(b.phone) || null, str(b.organization) || null, jobTitle, str(b.linkedin) || null, sponsor, now, speakerId).run();
  } else {
    speakerId = `spk_inv_${randomHex(8)}`;
    await c.env.DB.prepare(
      `INSERT INTO speakers (id, full_name, email, phone, organization, job_title, linkedin, sponsor_interest, is_public, confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
    ).bind(speakerId, name, email, str(b.phone) || null, str(b.organization) || null, jobTitle, str(b.linkedin) || null, sponsor).run();
  }
  await c.env.DB.prepare("UPDATE speaker_invites SET status='aangemeld', responded_at=?, speaker_id=? WHERE token=?")
    .bind(now, speakerId, inv.token).run();

  // Bevestiging direct (bevestigingsmails wachten niet op 9:30) + notificatie.
  try {
    const settings = await getSettings(c.env.DB);
    const cfg = mailConfig(c.env, settings);
    await speakerConfirmedMail(cfg, { full_name: name, email, job_title: jobTitle }, settings);
    const sponsorRegel = sponsor ? '<p><strong>Let op:</strong> deze voorlichter heeft interesse om sponsor te worden.</p>' : '';
    await sendEmail(cfg, {
      to: cfg.to,
      subject: `Voorlichter ${inv.kind === 'herhaal' ? 'opnieuw bevestigd' : 'aangemeld'} via uitnodiging: ${name}`,
      html: emailShell('Uitnodiging beantwoord', `<p><strong>${esc(name)}</strong> (${esc(jobTitle)}, ${esc(email)}) heeft de uitnodiging geaccepteerd.</p>${sponsorRegel}<p><a href="https://${esc(settings['site_host'] || 'inijmegen.com')}/admin/speakers">Bekijk in beheer</a></p>`, cfg.brand),
    });
  } catch (e) {
    console.error('uitnodiging-mails faalden:', e);
  }
  return c.redirect(`/voorlichter/uitnodiging?token=${inv.token}&klaar=1`, 302);
});

// ----------------------------------------------------------------------
// Evaluatie (proces 7)
// ----------------------------------------------------------------------

interface EvalTokenRow { token: string; speaker_id: string; event_id: string; }

async function getEvalCtx(c: { env: Env }, token: string) {
  const t = (await c.env.DB.prepare('SELECT * FROM speaker_eval_tokens WHERE token = ?').bind(token).first<EvalTokenRow>()) ?? null;
  if (!t) return null;
  const speaker = await c.env.DB.prepare('SELECT id, full_name FROM speakers WHERE id = ?').bind(t.speaker_id).first<{ id: string; full_name: string }>();
  if (!speaker) return null;
  const sessies = await c.env.DB.prepare(
    `SELECT s.id, r.round_no, r.start_time, r.end_time, cl.code AS lokaal
     FROM sessions_program s
     LEFT JOIN rounds r ON r.id = s.round_id
     LEFT JOIN classrooms cl ON cl.id = s.classroom_id
     JOIN speakers sp ON sp.beroep_id = s.beroep_id
     WHERE sp.id = ? AND s.event_id = ?
     ORDER BY r.round_no`
  ).bind(t.speaker_id, t.event_id).all<{ id: string; round_no: number | null; start_time: string | null; end_time: string | null; lokaal: string | null }>();
  return { t, speaker, sessies: sessies.results ?? [] };
}

procesApp.get('/evaluatie', async (c) => {
  const ctx = await getEvalCtx(c, c.req.query('token') ?? '');
  const [settings, navItems] = await Promise.all([getSettings(c.env.DB), getNavPages(c.env.DB)]);
  if (!ctx) return renderError(c, 404, 'Deze evaluatielink is niet geldig.');

  if (c.req.query('klaar')) {
    return c.html(renderLayout({
      title: 'Bedankt voor je evaluatie — Beroepenavond Nijmegen',
      metaDescription: null, navItems, activeSlug: '',
      hero: { eyebrow: 'Evaluatie', title: 'Bedankt!', compact: true },
      bodyHtml: `<p class="lede">Je evaluatie is opgeslagen. Dank voor je inzet vanavond, we hopen je volgend jaar weer te zien!</p>`,
      settings,
    }));
  }

  const bestaand = await c.env.DB.prepare('SELECT counts, questions, remarks, again FROM speaker_evaluations WHERE speaker_id = ? AND event_id = ?')
    .bind(ctx.t.speaker_id, ctx.t.event_id).first<{ counts: string | null; questions: string | null; remarks: string | null; again: string | null }>();
  let counts: Record<string, number> = {};
  try { counts = bestaand?.counts ? JSON.parse(bestaand.counts) : {}; } catch { /* leeg */ }

  const sessieVelden = ctx.sessies.length
    ? ctx.sessies.map((s) => `
      <div class="field"><label for="c-${esc(s.id)}">Aantal deelnemers, ronde ${s.round_no ?? '?'}${s.start_time ? ` (${esc(s.start_time)}${s.end_time ? ` tot ${esc(s.end_time)}` : ''})` : ''}${s.lokaal ? `, lokaal ${esc(s.lokaal)}` : ''}</label>
      <input id="c-${esc(s.id)}" type="number" min="0" max="500" name="count_${esc(s.id)}" value="${counts[s.id] ?? ''}"></div>`).join('')
    : `<div class="field"><label for="c-los">Hoeveel deelnemers had je in totaal?</label><input id="c-los" type="number" min="0" max="999" name="count_totaal" value=""></div>`;

  const again = bestaand?.again ?? '';
  const body = `
    <p class="lede">Beste ${esc(ctx.speaker.full_name)}, bedankt voor vanavond! Vul hieronder in twee minuten je evaluatie in.</p>
    <form class="form card-box" method="post" action="/evaluatie?token=${esc(ctx.t.token)}">
      ${sessieVelden}
      <div class="field"><label for="f-questions">Wat voor vragen kreeg je van de leerlingen?</label>
        <textarea id="f-questions" name="questions" rows="3">${esc(bestaand?.questions ?? '')}</textarea></div>
      <div class="field"><label for="f-remarks">Opmerkingen of tips voor de organisatie</label>
        <textarea id="f-remarks" name="remarks" rows="3">${esc(bestaand?.remarks ?? '')}</textarea></div>
      <div class="field"><label for="f-again">Doe je volgend jaar weer mee?</label>
        <select id="f-again" name="again">
          <option value="ja"${again === 'ja' ? ' selected' : ''}>Ja, graag!</option>
          <option value="misschien"${again === 'misschien' || !again ? ' selected' : ''}>Misschien, vraag het me tegen die tijd</option>
          <option value="nee"${again === 'nee' ? ' selected' : ''}>Nee</option>
        </select></div>
      <div class="form__actions"><button type="submit" class="btn btn--primary btn--lg">Evaluatie versturen</button></div>
    </form>`;

  return c.html(renderLayout({
    title: 'Evaluatie — Beroepenavond Nijmegen',
    metaDescription: null, navItems, activeSlug: '',
    hero: { eyebrow: 'Voorlichter', title: 'Hoe waren je sessies?', compact: true },
    bodyHtml: body,
    settings,
  }));
});

procesApp.post('/evaluatie', async (c) => {
  const ctx = await getEvalCtx(c, c.req.query('token') ?? '');
  if (!ctx) return renderError(c, 404, 'Deze evaluatielink is niet geldig.');
  const b = await c.req.parseBody();
  const counts: Record<string, number> = {};
  let totaal = 0;
  for (const s of ctx.sessies) {
    const n = parseInt(str(b[`count_${s.id}`]), 10);
    if (Number.isFinite(n) && n >= 0) { counts[s.id] = n; totaal += n; }
  }
  const los = parseInt(str(b['count_totaal']), 10);
  if (!ctx.sessies.length && Number.isFinite(los) && los >= 0) totaal = los;
  const again = ['ja', 'misschien', 'nee'].includes(str(b.again)) ? str(b.again) : 'misschien';
  await c.env.DB.prepare(
    `INSERT INTO speaker_evaluations (speaker_id, event_id, counts, total_participants, questions, remarks, again)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(speaker_id, event_id) DO UPDATE SET
       counts=excluded.counts, total_participants=excluded.total_participants,
       questions=excluded.questions, remarks=excluded.remarks, again=excluded.again`
  ).bind(ctx.t.speaker_id, ctx.t.event_id, JSON.stringify(counts), totaal, str(b.questions).slice(0, 4000) || null, str(b.remarks).slice(0, 4000) || null, again).run();
  return c.redirect(`/evaluatie?token=${ctx.t.token}&klaar=1`, 302);
});
