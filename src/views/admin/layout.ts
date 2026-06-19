/**
 * Admin-shell: sidebar-layout + herbruikbare form-componenten.
 * Bewust raw string-templates (geen JSX) — past bij de rest van de
 * codebase en houdt de Worker-bundle klein.
 */
import type { Context } from 'hono';
import { html, raw } from 'hono/html';
import type { AdminEnv } from '../../lib/auth';

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface NavItem {
  href: string;
  label: string;
  key: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: 'Algemeen',
    items: [{ href: '/admin', label: 'Dashboard', key: 'dashboard' }],
  },
  {
    title: 'Inhoud',
    items: [
      { href: '/admin/pages', label: "Pagina's", key: 'pages' },
      { href: '/admin/settings', label: 'Instellingen', key: 'settings' },
    ],
  },
  {
    title: 'Evenement',
    items: [
      { href: '/admin/events', label: 'Edities', key: 'events' },
      { href: '/admin/rounds', label: 'Rondes', key: 'rounds' },
      { href: '/admin/categories', label: 'Categorieën', key: 'categories' },
      { href: '/admin/beroepen', label: 'Beroepen', key: 'beroepen' },
    ],
  },
  {
    title: 'Programma',
    items: [
      { href: '/admin/speakers', label: 'Sprekers', key: 'speakers' },
      { href: '/admin/classrooms', label: 'Lokalen', key: 'classrooms' },
      { href: '/admin/floorplans', label: 'Plattegronden', key: 'floorplans' },
      { href: '/admin/sessions', label: 'Sessies', key: 'sessions' },
      { href: '/admin/floorplan-editor', label: 'Plattegrond-editor', key: 'editor' },
    ],
  },
];

export interface AdminLayoutOpts {
  title: string;
  activeKey: string;
  body: string;
  flash?: { ok?: string | null; err?: string | null };
}

export function renderAdminLayout(c: Context<AdminEnv>, opts: AdminLayoutOpts) {
  const user = c.get('user');
  const navHtml = NAV.map(
    (g) => `
      <div class="nav-group">
        <p class="nav-group__title">${esc(g.title)}</p>
        <ul>
          ${g.items
            .map(
              (it) =>
                `<li><a href="${it.href}" class="${
                  it.key === opts.activeKey ? 'active' : ''
                }">${esc(it.label)}</a></li>`
            )
            .join('')}
        </ul>
      </div>`
  ).join('');

  const ok = opts.flash?.ok;
  const err = opts.flash?.err;

  return c.html(html`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${opts.title} — Beheer Beroepenavond</title>
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/admin.css">
</head>
<body>
<div class="admin">
  <aside class="sidebar">
    <a class="sidebar__brand" href="/admin">
      <strong>Beroepenavond</strong>
      <span>Beheer</span>
    </a>
    <nav class="sidebar__nav">
      ${raw(navHtml)}
    </nav>
    <div class="sidebar__foot">
      <span class="sidebar__user">${esc(user?.name ?? '')}<small>${esc(
    user?.role ?? ''
  )}</small></span>
      <form method="post" action="/admin/logout">
        <button type="submit" class="btn btn--ghost btn--sm">Uitloggen</button>
      </form>
      <a class="sidebar__view" href="/" target="_blank" rel="noopener">Bekijk site ↗</a>
    </div>
  </aside>
  <main class="content">
    ${ok ? raw(`<div class="flash flash--ok">${esc(ok)}</div>`) : ''}
    ${err ? raw(`<div class="flash flash--err">${esc(err)}</div>`) : ''}
    ${raw(opts.body)}
  </main>
</div>
</body>
</html>`);
}

// ----------------------------------------------------------------------
// Form-componenten (geven HTML-strings terug)
// ----------------------------------------------------------------------

export function pageHeader(title: string, actionsHtml = ''): string {
  return `<header class="page-head">
    <h1>${esc(title)}</h1>
    <div class="page-head__actions">${actionsHtml}</div>
  </header>`;
}

interface FieldOpts {
  label: string;
  name: string;
  value?: unknown;
  type?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export function field(o: FieldOpts): string {
  return `<label class="fld">
    <span class="fld__label">${esc(o.label)}${o.required ? ' *' : ''}</span>
    <input class="fld__input" type="${o.type ?? 'text'}" name="${esc(o.name)}"
      value="${esc(o.value)}" ${o.required ? 'required' : ''}
      ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''}>
    ${o.help ? `<span class="fld__help">${esc(o.help)}</span>` : ''}
  </label>`;
}

interface TextareaOpts {
  label: string;
  name: string;
  value?: unknown;
  rows?: number;
  help?: string;
  mono?: boolean;
  placeholder?: string;
}

export function textarea(o: TextareaOpts): string {
  return `<label class="fld">
    <span class="fld__label">${esc(o.label)}</span>
    <textarea class="fld__input ${o.mono ? 'mono' : ''}" name="${esc(o.name)}"
      rows="${o.rows ?? 6}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''}>${esc(
    o.value
  )}</textarea>
    ${o.help ? `<span class="fld__help">${esc(o.help)}</span>` : ''}
  </label>`;
}

interface SelectOpts {
  label: string;
  name: string;
  value?: unknown;
  options: { value: string; label: string }[];
  help?: string;
  empty?: string;
}

export function select(o: SelectOpts): string {
  const cur = String(o.value ?? '');
  const opts = [
    o.empty ? `<option value="">${esc(o.empty)}</option>` : '',
    ...o.options.map(
      (op) =>
        `<option value="${esc(op.value)}" ${
          op.value === cur ? 'selected' : ''
        }>${esc(op.label)}</option>`
    ),
  ].join('');
  return `<label class="fld">
    <span class="fld__label">${esc(o.label)}</span>
    <select class="fld__input" name="${esc(o.name)}">${opts}</select>
    ${o.help ? `<span class="fld__help">${esc(o.help)}</span>` : ''}
  </label>`;
}

export function checkbox(o: {
  label: string;
  name: string;
  checked?: boolean;
  help?: string;
}): string {
  return `<label class="fld fld--check">
    <input type="checkbox" name="${esc(o.name)}" value="1" ${
    o.checked ? 'checked' : ''
  }>
    <span>${esc(o.label)}</span>
    ${o.help ? `<span class="fld__help">${esc(o.help)}</span>` : ''}
  </label>`;
}

/** Knoppenrij onderaan een formulier. */
export function formActions(saveLabel = 'Opslaan', cancelHref = ''): string {
  return `<div class="form-actions">
    <button type="submit" class="btn btn--primary">${esc(saveLabel)}</button>
    ${cancelHref ? `<a href="${cancelHref}" class="btn btn--ghost">Annuleren</a>` : ''}
  </div>`;
}

/** Kleine inline delete-form (POST met _method=delete-conventie via aparte route). */
export function deleteButton(action: string, confirm = 'Zeker weten verwijderen?'): string {
  return `<form method="post" action="${action}" onsubmit="return confirm('${esc(
    confirm
  )}')" class="inline-form">
    <button type="submit" class="btn btn--danger btn--sm">Verwijderen</button>
  </form>`;
}

/** Leest flash-messages uit de querystring (?ok=... / ?err=...). */
export function flashFromQuery(c: Context<AdminEnv>) {
  return { ok: c.req.query('ok') ?? null, err: c.req.query('err') ?? null };
}
