/**
 * Plattegrond-editor: teken per lokaal een polygon op de
 * achtergrond-afbeelding. De zware interactie zit in
 * /assets/js/floorplan-editor.js; deze route levert de data + shell.
 */
import { Hono } from 'hono';
import { html, raw } from 'hono/html';
import type { AdminEnv } from '../../lib/auth';
import { logAudit } from '../../lib/auth';
import { getActiveEvent } from '../../lib/db';
import { renderAdminLayout, esc, pageHeader, flashFromQuery } from '../../views/admin/layout';
import { str, strOrNull } from '../../lib/forms';

export const editorApp = new Hono<AdminEnv>();

interface Floorplan {
  id: string;
  floor_slug: string;
  floor_label: string;
  image_url: string;
  viewbox: string;
}
interface Classroom {
  id: string;
  code: string;
  name: string | null;
  map_shape: string | null;
  map_floor: string | null;
}

editorApp.get('/', async (c) => {
  const ev = await getActiveEvent(c.env.DB);
  if (!ev)
    return renderAdminLayout(c, {
      title: 'Plattegrond-editor',
      activeKey: 'editor',
      body: `${pageHeader('Plattegrond-editor')}<div class="card"><p>Maak eerst een <a href="/admin/events">editie</a> aan.</p></div>`,
    });

  const fps = await c.env.DB.prepare(
    'SELECT id, floor_slug, floor_label, image_url, viewbox FROM floorplans WHERE event_id = ? ORDER BY sort_order'
  )
    .bind(ev.id)
    .all<Floorplan>();
  const floors = fps.results ?? [];

  if (floors.length === 0) {
    return renderAdminLayout(c, {
      title: 'Plattegrond-editor',
      activeKey: 'editor',
      body: `${pageHeader('Plattegrond-editor')}<div class="card"><p>Voeg eerst een <a href="/admin/floorplans/new">plattegrond</a> toe (met achtergrond-afbeelding).</p></div>`,
    });
  }

  const current =
    floors.find((f) => f.id === c.req.query('floor')) ?? floors[0];

  const rooms = await c.env.DB.prepare(
    'SELECT id, code, name, map_shape, map_floor FROM classrooms WHERE event_id = ? ORDER BY code'
  )
    .bind(ev.id)
    .all<Classroom>();

  const data = {
    floor: current,
    classrooms: rooms.results ?? [],
  };

  const floorTabs = floors
    .map(
      (f) =>
        `<a class="btn ${f.id === current.id ? 'btn--primary' : 'btn--ghost'} btn--sm" href="/admin/floorplan-editor?floor=${esc(f.id)}">${esc(f.floor_label)}</a>`
    )
    .join('');

  const roomList = (rooms.results ?? [])
    .map(
      (r) =>
        `<li data-id="${esc(r.id)}" class="${r.map_shape && r.map_floor === current.floor_slug ? 'has-shape' : 'no-shape'}">${esc(r.code)}${r.name ? ` <span class="muted">· ${esc(r.name)}</span>` : ''}</li>`
    )
    .join('');

  const body = `
    ${pageHeader('Plattegrond-editor')}
    <div class="card">
      <div class="editor-toolbar">
        <span class="muted">Verdieping:</span> ${floorTabs}
        <span style="flex:1"></span>
        <button id="btnDraw" class="btn btn--primary btn--sm" type="button">✏︎ Nieuw tekenen</button>
        <button id="btnFinish" class="btn btn--ghost btn--sm" type="button" hidden>✓ Klaar</button>
        <button id="btnCancel" class="btn btn--ghost btn--sm" type="button" hidden>✕ Annuleer</button>
        <button id="btnClear" class="btn btn--danger btn--sm" type="button">Vorm wissen</button>
      </div>
      <p class="muted" id="editorHint">Kies links een lokaal, klik dan op
        “Nieuw tekenen” en zet punten op de kaart. Versleep punten om bij te
        stellen. Wijzigingen worden direct opgeslagen.</p>
      <div class="editor-layout">
        <div class="editor-stage" id="stage">
          <svg id="svg" viewBox="${esc(current.viewbox)}" xmlns="http://www.w3.org/2000/svg">
            ${current.image_url ? `<image href="${esc(current.image_url)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"></image>` : '<rect width="100%" height="100%" fill="#f0f0f0"></rect>'}
            <g id="shapes"></g>
            <g id="draft"></g>
            <g id="handles"></g>
          </svg>
        </div>
        <div>
          <p class="fld__label">Lokalen</p>
          <ul class="editor-list" id="roomList">${roomList || '<li class="muted">Geen lokalen — voeg ze toe onder Lokalen.</li>'}</ul>
        </div>
      </div>
    </div>
    <script type="application/json" id="editor-data">${raw(JSON.stringify(data))}</script>
    <script src="/assets/js/floorplan-editor.js" defer></script>`;

  return renderAdminLayout(c, { title: 'Plattegrond-editor', activeKey: 'editor', body, flash: flashFromQuery(c) });
});

/** Slaat de getekende vorm (of leeg) op voor één lokaal. */
editorApp.post('/save', async (c) => {
  const b = await c.req.json<{ classroom_id?: string; map_shape?: string | null; map_floor?: string }>().catch(() => null);
  if (!b || !b.classroom_id) return c.json({ ok: false, error: 'Ongeldig verzoek' }, 400);
  const shape = b.map_shape ? str(b.map_shape) : null;
  await c.env.DB.prepare('UPDATE classrooms SET map_shape = ?, map_floor = ? WHERE id = ?')
    .bind(shape, strOrNull(b.map_floor), b.classroom_id)
    .run();
  await logAudit(c, 'map_shape', 'classroom', b.classroom_id);
  return c.json({ ok: true });
});
