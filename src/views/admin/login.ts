/**
 * Inlog- en eerste-keer-setup-scherm. Als er nog geen users zijn toont
 * deze view een "maak eerste beheerder"-formulier i.p.v. login.
 */
import type { Context } from 'hono';
import { html, raw } from 'hono/html';
import type { AdminEnv } from '../../lib/auth';
import { esc } from './layout';

function shell(title: string, inner: string) {
  return html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} — Beheer Beroepenavond</title>
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/admin.css">
</head>
<body class="auth-body">
  <div class="auth-card">
    ${raw(inner)}
  </div>
</body>
</html>`;
}

export function renderLogin(
  c: Context<AdminEnv>,
  opts: { next?: string; error?: string | null } = {}
) {
  const inner = `
    <h1 class="auth-title">Beheer Beroepenavond</h1>
    <p class="auth-sub">Log in met een eenmalige code die we naar je e-mailadres sturen.
      Alleen e-mailadressen met een beheerdersaccount kunnen inloggen.</p>
    ${opts.error ? `<div class="flash flash--err">${esc(opts.error)}</div>` : ''}
    <form method="post" action="/admin/login" class="auth-form">
      <input type="hidden" name="next" value="${esc(opts.next ?? '/admin')}">
      <label class="fld">
        <span class="fld__label">E-mailadres</span>
        <input class="fld__input" type="email" name="email" required autofocus autocomplete="email">
      </label>
      <button type="submit" class="btn btn--primary btn--block">Stuur inlogcode</button>
    </form>`;
  return c.html(shell('Inloggen', inner));
}

/** Stap 2: 6-cijferige code invoeren. */
export function renderCodeForm(
  c: Context<AdminEnv>,
  opts: { email: string; next?: string; error?: string | null }
) {
  const inner = `
    <h1 class="auth-title">Voer je inlogcode in</h1>
    <p class="auth-sub">Als <strong>${esc(opts.email)}</strong> een beheerdersaccount is,
      staat er een 6-cijferige code in je mailbox. De code is 10 minuten geldig.</p>
    ${opts.error ? `<div class="flash flash--err">${esc(opts.error)}</div>` : ''}
    <form method="post" action="/admin/code" class="auth-form">
      <input type="hidden" name="next" value="${esc(opts.next ?? '/admin')}">
      <input type="hidden" name="email" value="${esc(opts.email)}">
      <label class="fld">
        <span class="fld__label">Inlogcode</span>
        <input class="fld__input" type="text" name="code" inputmode="numeric" pattern="[0-9]*"
          maxlength="6" required autofocus autocomplete="one-time-code"
          style="letter-spacing:.4em;font-size:1.4em;text-align:center">
      </label>
      <button type="submit" class="btn btn--primary btn--block">Inloggen</button>
    </form>
    <p style="text-align:center;margin-top:14px"><a href="/admin/login">&larr; Ander e-mailadres</a></p>`;
  return c.html(shell('Code invoeren', inner));
}

export function renderSetup(
  c: Context<AdminEnv>,
  opts: { error?: string | null } = {}
) {
  const inner = `
    <h1 class="auth-title">Eerste beheerder aanmaken</h1>
    <p class="auth-sub">Er zijn nog geen accounts. Maak het eerste
      beheerdersaccount aan om te beginnen.</p>
    ${opts.error ? `<div class="flash flash--err">${esc(opts.error)}</div>` : ''}
    <form method="post" action="/admin/setup" class="auth-form">
      <label class="fld">
        <span class="fld__label">Naam</span>
        <input class="fld__input" type="text" name="name" required autofocus>
      </label>
      <label class="fld">
        <span class="fld__label">E-mailadres</span>
        <input class="fld__input" type="email" name="email" required autocomplete="username">
      </label>
      <label class="fld">
        <span class="fld__label">Wachtwoord (min. 10 tekens)</span>
        <input class="fld__input" type="password" name="password" required minlength="10" autocomplete="new-password">
      </label>
      <label class="fld">
        <span class="fld__label">Wachtwoord herhalen</span>
        <input class="fld__input" type="password" name="password2" required minlength="10" autocomplete="new-password">
      </label>
      <button type="submit" class="btn btn--primary btn--block">Account aanmaken &amp; inloggen</button>
    </form>`;
  return c.html(shell('Setup', inner));
}
