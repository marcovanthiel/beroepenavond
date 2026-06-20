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

export interface MailConfig {
  apiKey?: string;
  from: string;
  to: string;
  replyTo?: string;
  enabled: boolean;
}

export function mailConfig(env: Env, settings: SettingsMap): MailConfig {
  return {
    apiKey: env.RESEND_API_KEY,
    from: settings['mail_from'] || 'Beroepenavond Nijmegen <noreply@inijmegen.com>',
    to: settings['mail_to'] || 'info@beroepenavondnijmegen.nl',
    replyTo: settings['mail_reply_to'] || undefined,
    enabled: (settings['mail_enabled'] ?? '1') === '1',
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

/** Eenvoudige, nette e-mail-wrapper in de huisstijl. */
export function emailShell(title: string, inner: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#15171a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#15171a;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">
      <strong style="font-size:18px">Beroepenavond Nijmegen</strong>
      <span style="color:#88bc1d;font-size:12px;letter-spacing:.1em;text-transform:uppercase;display:block">${esc(title)}</span>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e3e6ea;border-top:none">
      ${inner}
    </div>
    <p style="color:#8a9099;font-size:12px;text-align:center;margin-top:16px">
      Rotary Club Nijmegen-Stad en Land · Canisius College Nijmegen
    </p>
  </div></body></html>`;
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
    <p style="margin-top:18px"><a href="${esc(adminUrl)}" style="background:#88bc1d;color:#15171a;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Bekijk in beheer</a></p>`;
  await sendEmail(cfg, {
    to: cfg.to,
    subject: `${title}${s.name ? ` — ${s.name}` : ''}`,
    html: emailShell(title, inner),
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
    html: emailShell('Bevestiging', inner),
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
    html: emailShell('Bevestiging deelname', inner),
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
    <p><a href="${esc(confirmUrl)}" style="background:#88bc1d;color:#15171a;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Aanmelding bevestigen</a></p>
    <p style="color:#8a9099;font-size:13px">Heb je je niet aangemeld? Dan kun je deze mail negeren.</p>`;
  await sendEmail(cfg, {
    to: email,
    subject: 'Bevestig je aanmelding — Beroepenavond Nijmegen',
    html: emailShell('Nieuwsbrief', inner),
  });
}
