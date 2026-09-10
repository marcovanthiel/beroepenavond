/**
 * Inkomende mail (Email Routing → Worker), sept 2026.
 *
 * Lessen verwerkt: nooit stil laten vallen (audit-regel per mail + Workers
 * Logs), blokkadelijst voor gevaarlijke bijlagen (boven toelatingslijst),
 * inline afbeeldingen met content-id overslaan, raw-stream eerst bufferen,
 * en een auto-ontvangstbevestiging mét mail-loop-bescherming.
 * Domein-neutraal: er staat geen domeinnaam in deze code; alles komt uit
 * het bericht zelf en uit settings.
 */
import PostalMime from 'postal-mime';
import type { Env } from '../env';
import { getSettings } from './db';
import { mailConfig, sendEmail, emailShell } from './email';

/** Bijlage-extensies die we nooit opslaan (uitvoerbaar of actieve webinhoud). */
const GEBLOKKEERD = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'sh', 'js', 'jse', 'vbs', 'wsf',
  'jar', 'apk', 'app', 'dmg', 'zip', 'rar', '7z', 'gz', 'tar', 'iso',
  'docm', 'xlsm', 'pptm', 'html', 'htm', 'svg', 'xml', 'mht',
]);

function extensie(naam: string): string {
  const i = naam.lastIndexOf('.');
  return i >= 0 ? naam.slice(i + 1).toLowerCase() : '';
}

/** Herkent automatische afzenders (bounces, autoreplies) → geen auto-reply terug. */
function isAutomatisch(headers: Map<string, string>, from: string): boolean {
  const f = from.toLowerCase();
  if (/mailer-daemon|postmaster|no-?reply|bounce/.test(f)) return true;
  const auto = headers.get('auto-submitted');
  if (auto && auto.toLowerCase() !== 'no') return true;
  const prec = headers.get('precedence');
  if (prec && /bulk|junk|auto/i.test(prec)) return true;
  if (headers.get('x-auto-response-suppress')) return true;
  return false;
}

export async function handleInkomendeMail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const from = message.from ?? '';
  const to = message.to ?? '';
  let subject = '';
  try {
    // Raw stream is eenmalig leesbaar: eerst bufferen.
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await new PostalMime().parse(raw);
    subject = parsed.subject ?? '(zonder onderwerp)';
    const headers = new Map<string, string>();
    for (const h of parsed.headers ?? []) headers.set(h.key.toLowerCase(), h.value);

    // Bijlagen: blokkadelijst; inline afbeeldingen met content-id overslaan.
    const bijlagen: { key: string; filename: string; size: number; blocked: boolean }[] = [];
    let volgnr = 0;
    const mapKey = `mailbox/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    for (const att of parsed.attachments ?? []) {
      const naam = att.filename || `bijlage-${++volgnr}`;
      const inlineAfbeelding = att.disposition === 'inline' && att.contentId && (att.mimeType ?? '').startsWith('image/');
      if (inlineAfbeelding) continue; // handtekeningen-plaatjes
      const data = typeof att.content === 'string' ? new TextEncoder().encode(att.content) : new Uint8Array(att.content as ArrayBuffer);
      if (GEBLOKKEERD.has(extensie(naam)) || data.byteLength > 20 * 1024 * 1024) {
        bijlagen.push({ key: '', filename: naam, size: data.byteLength, blocked: true });
        continue;
      }
      if (!env.ASSETS_R2) {
        bijlagen.push({ key: '', filename: naam, size: data.byteLength, blocked: true });
        continue;
      }
      const key = `${mapKey}/${naam.replace(/[^\w.\-]+/g, '_').slice(0, 120)}`;
      await env.ASSETS_R2.put(key, data, { httpMetadata: { contentType: att.mimeType || 'application/octet-stream' } });
      bijlagen.push({ key, filename: naam, size: data.byteLength, blocked: false });
    }

    // Automatische koppeling aan een bekende voorlichter (op afzender).
    const fromEmail = (parsed.from?.address ?? from).toLowerCase();
    const spreker = await env.DB.prepare('SELECT id FROM speakers WHERE LOWER(email) = ? LIMIT 1')
      .bind(fromEmail).first<{ id: string }>();

    await env.DB.prepare(
      `INSERT INTO mail_inbox (message_id, from_email, from_name, to_email, subject, body_text, attachments, speaker_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      headers.get('message-id') ?? null,
      fromEmail,
      parsed.from?.name ?? null,
      to.toLowerCase(),
      subject.slice(0, 500),
      (parsed.text ?? '').slice(0, 100_000) || '(geen tekstinhoud)',
      JSON.stringify(bijlagen),
      spreker?.id ?? null
    ).run();

    const geblokkeerdeNamen = bijlagen.filter((b) => b.blocked).map((b) => b.filename);
    await env.DB.prepare('INSERT INTO mail_inbox_log (from_email, to_email, subject, outcome, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(fromEmail, to, subject.slice(0, 300), geblokkeerdeNamen.length ? 'bijlage_geblokkeerd' : 'opgenomen',
        geblokkeerdeNamen.length ? `geblokkeerd: ${geblokkeerdeNamen.join(', ')}` : null).run();

    // Ontvangstbevestiging (best effort, nooit naar automatische afzenders).
    if (!isAutomatisch(headers, fromEmail)) {
      try {
        const settings = await getSettings(env.DB);
        const cfg = mailConfig(env, settings);
        const blokkadeRegel = geblokkeerdeNamen.length
          ? `<p><strong>Let op:</strong> de bijlage(n) ${geblokkeerdeNamen.map((n) => `"${n}"`).join(', ')} zijn om veiligheidsredenen niet opgenomen. Stuur documenten bij voorkeur als PDF.</p>`
          : '';
        await sendEmail(cfg, {
          to: fromEmail,
          subject: `Ontvangen: ${subject.slice(0, 120)}`,
          html: emailShell('Ontvangstbevestiging', `<p>Beste ${parsed.from?.name ? parsed.from.name : 'inzender'},</p>
            <p>Je bericht "<strong>${subject.replace(/</g, '&lt;').slice(0, 160)}</strong>" is aangekomen bij de organisatie van de Beroepenavond. We lezen het en reageren als dat nodig is.</p>${blokkadeRegel}
            <p>Hartelijke groet,<br>Organisatie Beroepenavond Nijmegen</p>`, cfg.brand),
        });
      } catch (e) {
        console.error('ontvangstbevestiging faalde:', e);
      }
    }

    // Vangnet: doorsturen naar het (geverifieerde) organisatie-adres.
    try {
      const settings = await getSettings(env.DB);
      const doorTo = settings['mail_forward_to'] || settings['mail_to'];
      if (doorTo) await message.forward(doorTo);
    } catch (e) {
      console.log('forward niet mogelijk (adres niet geverifieerd?):', e);
    }
  } catch (e) {
    console.error('inkomende mail verwerken faalde:', e);
    try {
      await env.DB.prepare('INSERT INTO mail_inbox_log (from_email, to_email, subject, outcome, detail) VALUES (?, ?, ?, ?, ?)')
        .bind(from, to, subject.slice(0, 300), 'fout', String(e).slice(0, 500)).run();
    } catch { /* log mag nooit escaleren */ }
  }
}
