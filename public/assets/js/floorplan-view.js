/* Publieke plattegrond: verdieping-tabs + klik-op-lokaal → modal. */
(function () {
  'use strict';
  var dataEl = document.getElementById('map-data');
  if (!dataEl) return;
  var ROOMS = JSON.parse(dataEl.textContent);

  var modal = document.getElementById('mapModal');
  var title = document.getElementById('mapModalTitle');
  var body = document.getElementById('mapModalBody');

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openRoom(id) {
    var room = ROOMS[id];
    if (!room) return;
    title.textContent = room.name ? room.code + ' — ' + room.name : 'Lokaal ' + room.code;
    if (!room.sessions || room.sessions.length === 0) {
      body.innerHTML = '<p style="color:#667">Voor dit lokaal is nog geen sessie ingepland.</p>';
    } else {
      body.innerHTML = room.sessions.map(function (s) {
        var cat = s.catName
          ? '<span class="map-sessie__cat" style="background:' + escapeHtml(s.catColor || '#88bc1d') + '">' + escapeHtml(s.catName) + '</span><br>'
          : '';
        var meta = [];
        if (s.round) meta.push(escapeHtml(s.round));
        if (s.speakers && s.speakers.length) meta.push(escapeHtml(s.speakers.join(', ')));
        return '<div class="map-sessie">' + cat +
          '<h4>' + escapeHtml(s.profession) + '</h4>' +
          (s.title ? '<p class="map-sessie__meta">' + escapeHtml(s.title) + '</p>' : '') +
          (meta.length ? '<p class="map-sessie__meta">' + meta.join(' · ') + '</p>' : '') +
          '</div>';
      }).join('');
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('.map-room');
    if (g) { openRoom(g.getAttribute('data-room-id')); return; }
    if (e.target.id === 'mapModalClose' || e.target === modal) close();
    var tab = e.target.closest && e.target.closest('.map-tab');
    if (tab) {
      var floor = tab.getAttribute('data-floor');
      Array.prototype.forEach.call(document.querySelectorAll('.map-tab'), function (t) {
        t.classList.toggle('active', t === tab);
      });
      Array.prototype.forEach.call(document.querySelectorAll('.map-panel'), function (p) {
        p.hidden = p.getAttribute('data-floor') !== floor;
      });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('map-room')) {
      e.preventDefault();
      openRoom(e.target.getAttribute('data-room-id'));
    }
  });
})();
