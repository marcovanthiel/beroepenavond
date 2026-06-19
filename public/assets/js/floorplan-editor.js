/* Plattegrond-editor — polygons tekenen per lokaal.
   Leest data uit #editor-data, slaat op via POST /admin/floorplan-editor/save. */
(function () {
  'use strict';
  var dataEl = document.getElementById('editor-data');
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var FLOOR = DATA.floor;
  var rooms = DATA.classrooms || [];

  var svg = document.getElementById('svg');
  var gShapes = document.getElementById('shapes');
  var gDraft = document.getElementById('draft');
  var gHandles = document.getElementById('handles');
  var listEl = document.getElementById('roomList');
  var hint = document.getElementById('editorHint');

  var SVGNS = 'http://www.w3.org/2000/svg';
  var selectedId = null;
  var mode = 'idle'; // 'idle' | 'draw'
  var draft = [];
  var dragIdx = -1;

  function roomById(id) {
    for (var i = 0; i < rooms.length; i++) if (rooms[i].id === id) return rooms[i];
    return null;
  }

  function parseShape(s) {
    if (!s) return null;
    try {
      var o = JSON.parse(s);
      if (o.shape === 'polygon' && o.points) {
        return o.points.trim().split(/\s+/).map(function (p) {
          var xy = p.split(',');
          return { x: parseFloat(xy[0]), y: parseFloat(xy[1]) };
        });
      }
      if (o.shape === 'rect') {
        return [
          { x: o.x, y: o.y },
          { x: o.x + o.w, y: o.y },
          { x: o.x + o.w, y: o.y + o.h },
          { x: o.x, y: o.y + o.h },
        ];
      }
    } catch (e) {}
    return null;
  }

  function ptsToStr(pts) {
    return JSON.stringify({
      shape: 'polygon',
      points: pts.map(function (p) {
        return Math.round(p.x) + ',' + Math.round(p.y);
      }).join(' '),
    });
  }

  function centroid(pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }

  function svgPoint(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var u = pt.matrixTransform(ctm.inverse());
    return { x: u.x, y: u.y };
  }

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function onThisFloor(r) {
    return r.map_shape && r.map_floor === FLOOR.floor_slug;
  }

  function render() {
    gShapes.innerHTML = '';
    gHandles.innerHTML = '';
    rooms.forEach(function (r) {
      if (!onThisFloor(r)) return;
      var pts = parseShape(r.map_shape);
      if (!pts || pts.length < 3) return;
      var poly = el('polygon', {
        points: pts.map(function (p) { return p.x + ',' + p.y; }).join(' '),
        class: 'room' + (r.id === selectedId ? ' sel' : ''),
        'data-id': r.id,
      });
      poly.addEventListener('click', function (e) {
        e.stopPropagation();
        if (mode === 'draw') return;
        selectRoom(r.id);
      });
      gShapes.appendChild(poly);
      var ctr = centroid(pts);
      var label = el('text', { x: ctr.x, y: ctr.y, class: 'room-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
      label.textContent = r.code;
      gShapes.appendChild(label);

      if (r.id === selectedId) {
        pts.forEach(function (p, i) {
          var h = el('circle', { cx: p.x, cy: p.y, r: 7, class: 'vertex', 'data-i': i });
          h.addEventListener('pointerdown', startDrag);
          gHandles.appendChild(h);
        });
      }
    });
    renderDraft();
    renderList();
  }

  function renderDraft() {
    gDraft.innerHTML = '';
    if (mode !== 'draw' || draft.length === 0) return;
    if (draft.length > 1) {
      gDraft.appendChild(el('polyline', {
        points: draft.map(function (p) { return p.x + ',' + p.y; }).join(' '),
        fill: 'rgba(136,188,29,.2)', stroke: '#6f9a16', 'stroke-width': 2, 'stroke-dasharray': '5 4',
      }));
    }
    draft.forEach(function (p) {
      gDraft.appendChild(el('circle', { cx: p.x, cy: p.y, r: 6, fill: '#fff', stroke: '#6f9a16', 'stroke-width': 2 }));
    });
  }

  function renderList() {
    Array.prototype.forEach.call(listEl.querySelectorAll('li'), function (li) {
      var id = li.getAttribute('data-id');
      if (!id) return;
      var r = roomById(id);
      li.classList.toggle('sel', id === selectedId);
      li.classList.toggle('has-shape', !!(r && onThisFloor(r)));
      li.classList.toggle('no-shape', !(r && onThisFloor(r)));
    });
  }

  function selectRoom(id) {
    selectedId = id;
    render();
    var r = roomById(id);
    hint.textContent = r
      ? 'Geselecteerd: ' + r.code + '. Klik “Nieuw tekenen” om een vorm te zetten, of versleep de punten.'
      : '';
  }

  function startDraw() {
    if (!selectedId) { hint.textContent = 'Kies eerst een lokaal links.'; return; }
    mode = 'draw';
    draft = [];
    document.getElementById('btnDraw').hidden = true;
    document.getElementById('btnFinish').hidden = false;
    document.getElementById('btnCancel').hidden = false;
    hint.textContent = 'Klik punten op de kaart (min. 3). Dubbelklik of “Klaar” om af te ronden.';
    render();
  }

  function finishDraw() {
    if (draft.length >= 3) {
      saveShape(selectedId, ptsToStr(draft));
    }
    cancelDraw();
  }

  function cancelDraw() {
    mode = 'idle';
    draft = [];
    document.getElementById('btnDraw').hidden = false;
    document.getElementById('btnFinish').hidden = true;
    document.getElementById('btnCancel').hidden = true;
    render();
  }

  function clearShape() {
    if (!selectedId) return;
    if (!confirm('Vorm van dit lokaal wissen?')) return;
    saveShape(selectedId, null);
  }

  function saveShape(roomId, shapeStr) {
    var r = roomById(roomId);
    if (!r) return;
    r.map_shape = shapeStr;
    r.map_floor = shapeStr ? FLOOR.floor_slug : r.map_floor;
    render();
    fetch('/admin/floorplan-editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classroom_id: roomId, map_shape: shapeStr, map_floor: FLOOR.floor_slug }),
    })
      .then(function (res) { return res.json(); })
      .then(function (j) { hint.textContent = j.ok ? 'Opgeslagen ✓' : 'Opslaan mislukt'; })
      .catch(function () { hint.textContent = 'Opslaan mislukt (netwerk).'; });
  }

  // --- vertex drag ---
  function startDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    dragIdx = parseInt(e.target.getAttribute('data-i'), 10);
    svg.setPointerCapture(e.pointerId);
    svg.addEventListener('pointermove', onDrag);
    svg.addEventListener('pointerup', endDrag);
  }
  function onDrag(e) {
    if (dragIdx < 0 || !selectedId) return;
    var r = roomById(selectedId);
    var pts = parseShape(r.map_shape);
    if (!pts) return;
    var u = svgPoint(e);
    pts[dragIdx] = { x: u.x, y: u.y };
    r.map_shape = ptsToStr(pts);
    render();
  }
  function endDrag(e) {
    if (dragIdx < 0) return;
    dragIdx = -1;
    svg.removeEventListener('pointermove', onDrag);
    svg.removeEventListener('pointerup', endDrag);
    saveShape(selectedId, roomById(selectedId).map_shape);
  }

  // --- canvas clicks ---
  svg.addEventListener('click', function (e) {
    if (mode !== 'draw') return;
    var u = svgPoint(e);
    draft.push({ x: u.x, y: u.y });
    renderDraft();
  });
  svg.addEventListener('dblclick', function (e) {
    if (mode === 'draw') { e.preventDefault(); finishDraw(); }
  });

  listEl.addEventListener('click', function (e) {
    var li = e.target.closest('li[data-id]');
    if (li) selectRoom(li.getAttribute('data-id'));
  });

  document.getElementById('btnDraw').addEventListener('click', startDraw);
  document.getElementById('btnFinish').addEventListener('click', finishDraw);
  document.getElementById('btnCancel').addEventListener('click', cancelDraw);
  document.getElementById('btnClear').addEventListener('click', clearShape);
  document.addEventListener('keydown', function (e) {
    if (mode === 'draw' && e.key === 'Enter') finishDraw();
    if (mode === 'draw' && e.key === 'Escape') cancelDraw();
  });

  render();
})();
