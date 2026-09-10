/**
 * Uitgaande e-mail via de Resend REST API.
 *
 * Volledig config-gestuurd: afzender/ontvanger komen uit `settings`
 * (mail_from / mail_to / mail_reply_to / mail_enabled), de API-key uit
 * een Worker-secret (RESEND_API_KEY). Ontbreekt de key of staat
 * mail_enabled uit, dan wordt er niets verstuurd — inzendingen worden
 * dan nog steeds in de database opgeslagen. E-mail mag nooit een
 * formulier-submit laten falen, dus alles is best-effort.
 */
import type { Env } from '../env';
import type { SettingsMap } from '../env';

/** Merkgegevens voor het brandingblok onderin elke mail. */
export interface MailBrand {
  slogan: string;
  datum: string;
  host: string;
}

export interface MailConfig {
  apiKey?: string;
  from: string;
  to: string;
  replyTo?: string;
  enabled: boolean;
  brand: MailBrand;
}

export function mailConfig(env: Env, settings: SettingsMap): MailConfig {
  return {
    apiKey: env.RESEND_API_KEY,
    from: settings['mail_from'] || 'Beroepenavond Nijmegen <noreply@inijmegen.com>',
    to: settings['mail_to'] || 'info@beroepenavondnijmegen.nl',
    replyTo: settings['mail_reply_to'] || undefined,
    enabled: (settings['mail_enabled'] ?? '1') === '1',
    brand: {
      // Overschrijfbaar via de settings-tabel (admin → Instellingen).
      slogan: settings['mail_slogan'] || '169 professionals. Eén missie.',
      datum: (settings['event_date_long'] || 'Donderdag 20 november 2026') +
        ' · ' + (settings['venue_name'] || 'Canisius College Nijmegen'),
      host: settings['site_host'] || 'inijmegen.com',
    },
  };
}

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(
  cfg: MailConfig,
  args: SendArgs
): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  if (!cfg.enabled || !cfg.apiKey) {
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo ?? cfg.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Resend-fout', res.status, body);
      return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (e) {
    console.error('sendEmail faalde:', e);
    return { ok: false, error: String(e) };
  }
}

// ----------------------------------------------------------------------
// Opmaak-helpers
// ----------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * E-mail-wrapper in de huisstijl "Kleurblok" (herontwerp 2026).
 * E-mailveilig: tabellen, inline CSS, systeemfonts (geen webfonts in
 * mailclients), geen border-radius. De zes categoriekleuren vormen de
 * merkstrip onder de zwarte kopbalk.
 */
export function emailShell(title: string, inner: string, brand?: MailBrand): string {
  const strip = ['#E14B64', '#2E7ED4', '#F0A400', '#55862A', '#8A4FD0', '#0A9B9B']
    .map((c) => `<td style="height:8px;background:${c};font-size:0;line-height:0">&nbsp;</td>`)
    .join('');
  // Jaarfiguur wisselt per dag van gedaante (man/vrouw/X), net als op de site.
  const dag = Math.floor(Date.now() / 86400000);
  const gedaante = (['man', 'vrouw', 'x'] as const)[dag % 3];
  const host = brand?.host || 'inijmegen.com';
  const merkblok = brand
    ? `<tr><td style="background:#0d0d0d;padding:0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:24px 28px;vertical-align:middle">
            <span style="display:block;color:#ffffff;font-size:21px;font-weight:800;line-height:1.15">${esc(brand.slogan)}</span>
            <span style="display:block;color:#bbbbbb;font-size:13px;margin-top:10px">${esc(brand.datum)}</span>
            <a href="https://${esc(host)}/" style="display:inline-block;color:#ffffff;font-size:13px;font-weight:bold;margin-top:12px;text-decoration:underline">Ontdek alle beroepen op ${esc(host)}</a>
          </td>
          <td width="120" style="background:#2E7ED4;vertical-align:bottom;padding:0;line-height:0">
            <img src="https://${esc(host)}/assets/img/mail-figuur-${gedaante}.png" width="120" height="156" alt="Het jaarfiguur van de Beroepenavond" style="display:block;width:120px;height:auto;border:0">
          </td>
        </tr></table>
      </td></tr>`
    : '';
  return `<!DOCTYPE html><html lang="nl"><body style="margin:0;padding:0;background:#f2f2ef">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2ef"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:Arial,Helvetica,sans-serif;color:#0d0d0d">
      <tr><td style="background:#0d0d0d;padding:20px 28px">
        <span style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:.5px">BEROEPENAVOND</span>
        <span style="color:#9a9a9a;font-size:12px;letter-spacing:2px;font-weight:600">&nbsp;NIJMEGEN</span>
        <span style="display:block;color:#bbbbbb;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-top:6px">${esc(title)}</span>
      </td></tr>
      <tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${strip}</tr></table></td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e2e2e0;border-top:none;padding:26px 28px;font-size:14px;line-height:1.6">
        ${inner}
      </td></tr>
      ${merkblok}
      <tr><td style="padding:16px 8px 0;text-align:center;color:#8a8a86;font-size:12px;line-height:1.5">
        Rotary Club Nijmegen-Stad en Land · met de decanen van de scholen in Nijmegen e.o.<br>
        Canisius College Nijmegen
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** Knop in de huisstijl: zwart vlak, witte vette tekst, geen radius. */
export function emailButton(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:#0d0d0d;color:#ffffff;padding:13px 24px;text-decoration:none;font-weight:bold;font-size:14px">${esc(label)}</a>`;
}

interface SubmissionLike {
  type: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  profession?: string | null;
  message?: string | null;
}

/** Notificatie naar de organisatie bij een nieuwe inzending. */
export async function notifySubmission(
  cfg: MailConfig,
  s: SubmissionLike,
  adminUrl: string
): Promise<void> {
  const isVolunteer = s.type === 'volunteer';
  const title = isVolunteer ? 'Nieuwe voorlichter-aanmelding' : 'Nieuw contactbericht';
  const rows = [
    ['Naam', s.name],
    ['E-mail', s.email],
    ['Telefoon', s.phone],
    ['Organisatie', s.organization],
    isVolunteer ? ['Beroep', s.profession] : null,
    ['Bericht', s.message],
  ].filter(Boolean) as [string, unknown][];
  const inner = `
    <h2 style="margin:0 0 14px;font-size:18px">${esc(title)}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 8px;color:#667;vertical-align:top;width:110px">${esc(k)}</td>
             <td style="padding:6px 8px;white-space:pre-wrap">${esc(v) || '—'}</td></tr>`
        )
        .join('')}
    </table>
    <p style="margin-top:18px">${emailButton(adminUrl, 'Bekijk in beheer')}</p>`;
  await sendEmail(cfg, {
    to: cfg.to,
    subject: `${title}${s.name ? ` — ${s.name}` : ''}`,
    html: emailShell(title, inner, cfg.brand),
    replyTo: s.email || undefined,
  });
}

/** Bevestigingsmail naar de inzender (best effort). */
export async function confirmToSender(
  cfg: MailConfig,
  s: SubmissionLike
): Promise<void> {
  if (!s.email) return;
  const inner = `
    <p>Beste ${esc(s.name) || 'bezoeker'},</p>
    <p>Bedankt voor je bericht aan de Beroepenavond Nijmegen. We hebben het
    in goede orde ontvangen en nemen indien nodig contact met je op.</p>
    <p>Met vriendelijke groet,<br>Organisatie Beroepenavond Nijmegen</p>`;
  await sendEmail(cfg, {
    to: s.email,
    subject: 'Bedankt voor je bericht — Beroepenavond Nijmegen',
    html: emailShell('Bevestiging', inner, cfg.brand),
  });
}

/** Bevestigingsmail naar een voorlichter zodra die is bevestigd. */
export async function speakerConfirmedMail(
  cfg: MailConfig,
  speaker: { full_name: string; email?: string | null; job_title?: string | null },
  settings: SettingsMap
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!speaker.email) return { ok: false, skipped: true };
  const datum = settings['event_date_long'] || '';
  const inner = `
    <p>Beste ${esc(speaker.full_name)},</p>
    <p>Wat leuk dat je meedoet aan de <strong>Beroepenavond Nijmegen</strong>${
      datum ? ` op <strong>${esc(datum)}</strong>` : ''
    }! Je deelname${
      speaker.job_title ? ` als <strong>${esc(speaker.job_title)}</strong>` : ''
    } is bevestigd en je komt op de website te staan zodra we het voorlichters-overzicht publiceren.</p>
    <p>We nemen tijdig contact op met de praktische details voor de avond.
    Heb je tussentijds vragen? Mail gerust naar ${esc(cfg.to)}.</p>
    <p>Hartelijke groet,<br>Organisatie Beroepenavond Nijmegen</p>`;
  return sendEmail(cfg, {
    to: speaker.email,
    subject: 'Je deelname aan de Beroepenavond is bevestigd',
    html: emailShell('Bevestiging deelname', inner, cfg.brand),
  });
}

/** Dubbel-opt-in bevestigingsmail voor de nieuwsbrief. */
export async function newsletterConfirm(
  cfg: MailConfig,
  email: string,
  confirmUrl: string
): Promise<void> {
  const inner = `
    <p>Bevestig je aanmelding voor updates over de Beroepenavond Nijmegen
    door op de knop te klikken:</p>
    <p>${emailButton(confirmUrl, 'Aanmelding bevestigen')}</p>
    <p style="color:#8a8a86;font-size:13px">Heb je je niet aangemeld? Dan kun je deze mail negeren.</p>`;
  await sendEmail(cfg, {
    to: email,
    subject: 'Bevestig je aanmelding — Beroepenavond Nijmegen',
    html: emailShell('Nieuwsbrief', inner, cfg.brand),
  });
}
