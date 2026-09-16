/* Beheer-paneel: kleine progressive-enhancement laag.
   - Direct zoeken/filteren in lijsten (geen herladen)
   - Spinner + dubbel-verzenden-beveiliging op formulieren
   Werkt volledig zonder JS (alles blijft server-side); dit maakt het alleen
   prettiger. */
(function () {
  'use strict';

  // ---- Zijbalk: menugroepen in-/uitklappen ----------------------------
  // Standaard staan alle groepen dicht; de server zet alleen de groep met de
  // actieve pagina open. Klik op een groep om een andere open te klappen; de
  // rest sluit dan (accordeon), zodat het overzicht rustig blijft. De actieve
  // groep laat zich ook sluiten. Werkt zonder JS (dan blijft alleen de actieve
  // groep open, en zijn de <details> los te openen).
  (function () {
    var groups = document.querySelectorAll('details.nav-group');
    if (!groups.length) return;
    groups.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        groups.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });
  })();

  // ---- Direct zoeken in tabellen --------------------------------------
  // Een <input data-filter-target="#tabel-id" data-filter-count="#teller-id">
  // filtert de <tr>'s van die tabel op tekst. Een rij met [data-filter-empty]
  // verschijnt zodra niets matcht.
  document.querySelectorAll('input[data-filter-target]').forEach(function (input) {
    var table = document.querySelector(input.getAttribute('data-filter-target'));
    if (!table || !table.tBodies.length) return;
    var countSel = input.getAttribute('data-filter-count');
    var countEl = countSel ? document.querySelector(countSel) : null;
    var emptyRow = table.querySelector('[data-filter-empty]');
    var countTpl = countEl ? countEl.textContent : '';

    function dataRows() {
      return Array.prototype.filter.call(table.tBodies[0].rows, function (r) {
        return !r.hasAttribute('data-filter-empty');
      });
    }

    function apply() {
      var q = input.value.trim().toLowerCase();
      var rows = dataRows();
      var visible = 0;
      rows.forEach(function (r) {
        var match = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.hidden = !match;
        if (match) visible++;
      });
      if (emptyRow) emptyRow.hidden = visible !== 0;
      if (countEl) {
        countEl.textContent = q
          ? visible + ' van ' + rows.length + ' gevonden'
          : countTpl;
      }
    }

    input.addEventListener('input', apply);
    // Escape leegt het zoekveld.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; apply(); }
    });
  });

  // ---- Sorteerbare + per-kolom filterbare tabel -----------------------
  // <table data-sortfilter> met twee koprijen: <tr class="sf-head"> met per
  // kolom <th data-sort="text|num|bool"> (klik = sorteren) en <tr class="sf-filter">
  // met per kolom een <input|select data-sf-filter="<kolomindex>">. Een los
  // <input data-sf-search="<tabel-id>"> zoekt in alle kolommen; <span
  // data-sf-count="<tabel-id>"> toont de teller. Cellen mogen data-sf dragen
  // met de sorteer-/filterwaarde (anders wordt de zichtbare tekst gebruikt).
  document.querySelectorAll('table[data-sortfilter]').forEach(function (table) {
    var tbody = table.tBodies[0];
    if (!tbody) return;
    var id = table.id;
    var search = id ? document.querySelector('input[data-sf-search="' + id + '"]') : null;
    var countEl = id ? document.querySelector('[data-sf-count="' + id + '"]') : null;
    var countTpl = countEl ? countEl.textContent : '';
    var emptyRow = table.querySelector('[data-filter-empty]');
    var headCells = table.querySelectorAll('tr.sf-head > th');
    var filters = {}; // kolomindex -> zoekwaarde (lowercase)

    function dataRows() {
      return Array.prototype.filter.call(tbody.rows, function (r) {
        return !r.hasAttribute('data-filter-empty');
      });
    }
    function cellVal(row, col) {
      var td = row.cells[col];
      if (!td) return '';
      var v = td.getAttribute('data-sf');
      return (v != null ? v : td.textContent).trim();
    }
    function apply() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var rows = dataRows();
      var visible = 0;
      rows.forEach(function (r) {
        var ok = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        if (ok) {
          for (var col in filters) {
            if (!filters[col]) continue;
            if (cellVal(r, col).toLowerCase().indexOf(filters[col]) === -1) { ok = false; break; }
          }
        }
        r.hidden = !ok;
        if (ok) visible++;
      });
      if (emptyRow) emptyRow.hidden = visible !== 0;
      if (countEl) {
        var active = q || Object.keys(filters).some(function (k) { return filters[k]; });
        countEl.textContent = active ? visible + ' van ' + rows.length + ' gevonden' : countTpl;
      }
    }

    if (search) {
      search.addEventListener('input', apply);
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { search.value = ''; apply(); }
        if (e.key === 'Enter') e.preventDefault();
      });
    }
    table.querySelectorAll('[data-sf-filter]').forEach(function (ctrl) {
      var col = parseInt(ctrl.getAttribute('data-sf-filter'), 10);
      var ev = ctrl.tagName === 'SELECT' ? 'change' : 'input';
      ctrl.addEventListener(ev, function () { filters[col] = ctrl.value.trim().toLowerCase(); apply(); });
      ctrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    });

    // Sorteren op kolomkop
    var sortState = { col: -1, dir: 1 };
    Array.prototype.forEach.call(headCells, function (th, col) {
      var type = th.getAttribute('data-sort');
      if (!type) return;
      th.classList.add('sortable-th');
      th.setAttribute('role', 'button');
      th.setAttribute('tabindex', '0');
      function doSort() {
        sortState.dir = sortState.col === col ? -sortState.dir : 1;
        sortState.col = col;
        var rows = dataRows();
        rows.sort(function (a, b) {
          var va = cellVal(a, col), vb = cellVal(b, col);
          var r;
          if (type === 'num' || type === 'bool') {
            r = (parseFloat(va) || 0) - (parseFloat(vb) || 0);
          } else {
            r = va.localeCompare(vb, 'nl', { numeric: true, sensitivity: 'base' });
          }
          return r * sortState.dir;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
        if (emptyRow) tbody.appendChild(emptyRow);
        Array.prototype.forEach.call(headCells, function (h) { h.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', sortState.dir === 1 ? 'ascending' : 'descending');
      }
      th.addEventListener('click', doSort);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSort(); }
      });
    });

    apply();
  });

  // ---- Aanvinklijst lokalen: live teller + alles aan/uit --------------
  // <span data-usecount> telt de aangevinkte use-checkboxes; knoppen
  // <button data-check-all="use:1|use:0|sb:1|sb:0"> vinken alle in beeld
  // zichtbare rijen voor dat veld aan/uit. Werkt zonder JS (server bepaalt).
  (function () {
    var form = document.querySelector('form[action="/admin/classrooms/gebruik"]');
    if (!form) return;
    var counter = document.querySelector('[data-usecount]');
    function updateCount() {
      if (!counter) return;
      var all = form.querySelectorAll('input[name="use"]');
      var on = 0;
      all.forEach(function (b) { if (b.checked) on++; });
      counter.textContent = on + ' van ' + all.length + ' gebruikt';
    }
    // Houd data-sf op de cel gelijk aan de checkbox, zodat sorteren klopt.
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t && (t.name === 'use' || t.name === 'sb')) {
        var td = t.closest('td');
        if (td) td.setAttribute('data-sf', t.checked ? '1' : '0');
        if (t.name === 'use') updateCount();
      }
    });
    document.querySelectorAll('button[data-check-all]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.getAttribute('data-check-all').split(':');
        var field = parts[0], on = parts[1] === '1';
        form.querySelectorAll('input[name="' + field + '"]').forEach(function (b) {
          var tr = b.closest('tr');
          if (tr && tr.hidden) return; // door filter verborgen: overslaan
          if (b.checked !== on) {
            b.checked = on;
            var td = b.closest('td');
            if (td) td.setAttribute('data-sf', on ? '1' : '0');
          }
        });
        updateCount();
      });
    });
    updateCount();
  })();

  // ---- Direct zoeken in een lijst (bv. spreker-keuzevakjes) -----------
  // <input data-filter-list="#container"> verbergt de directe kinderen van
  // dat element die niet matchen.
  document.querySelectorAll('input[data-filter-list]').forEach(function (input) {
    var box = document.querySelector(input.getAttribute('data-filter-list'));
    if (!box) return;
    var countSel = input.getAttribute('data-filter-count');
    var countEl = countSel ? document.querySelector(countSel) : null;
    var countTpl = countEl ? countEl.textContent : '';
    var items = Array.prototype.slice.call(box.children);

    function apply() {
      var q = input.value.trim().toLowerCase();
      var vis = 0;
      items.forEach(function (el) {
        var m = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
        el.hidden = !m;
        if (m) vis++;
      });
      if (countEl) countEl.textContent = q ? vis + ' van ' + items.length + ' gevonden' : countTpl;
    }
    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; apply(); }
    });
  });

  // ---- Bulk-selectie (alles-selecteren + teller) ----------------------
  function updateBulkCount() {
    var n = document.querySelectorAll('input[data-bulk-item]:checked').length;
    document.querySelectorAll('[data-bulk-count]').forEach(function (el) {
      el.textContent = n + ' geselecteerd';
      var bar = el.closest('.bulk-bar');
      if (bar) bar.classList.toggle('is-active', n > 0);
    });
  }
  document.querySelectorAll('[data-bulk-all]').forEach(function (master) {
    var table = document.querySelector(master.getAttribute('data-bulk-target'));
    if (!table) return;
    master.addEventListener('change', function () {
      Array.prototype.forEach.call(table.querySelectorAll('input[data-bulk-item]'), function (cb) {
        var row = cb.closest('tr');
        if (row && row.hidden) return; // alleen zichtbare rijen (na zoekfilter)
        cb.checked = master.checked;
      });
      updateBulkCount();
    });
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.matches && e.target.matches('input[data-bulk-item]')) updateBulkCount();
  });

  // ---- Doorzoekbaar keuzeveld (combobox) ------------------------------
  // <select data-combo> wordt verrijkt tot een typ-om-te-zoeken keuzeveld.
  // De originele <select> blijft (verborgen) de bron voor het formulier,
  // dus zonder JS werkt het als gewone dropdown.
  function enhanceCombo(select) {
    if (select.dataset.comboReady) return;
    select.dataset.comboReady = '1';

    var items = [];
    Array.prototype.forEach.call(select.children, function (node) {
      if (node.tagName === 'OPTGROUP') {
        Array.prototype.forEach.call(node.children, function (opt) {
          items.push({ value: opt.value, label: opt.textContent, group: node.label });
        });
      } else if (node.tagName === 'OPTION') {
        items.push({ value: node.value, label: node.textContent, group: '' });
      }
    });

    var wrap = document.createElement('div');
    wrap.className = 'combo';
    select.parentNode.insertBefore(wrap, select);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'fld__input combo__input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.placeholder = select.getAttribute('data-combo-placeholder') || 'Typ om te zoeken…';

    wrap.appendChild(input);
    wrap.appendChild(select);
    select.classList.add('combo__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    var menu = document.createElement('div');
    menu.className = 'combo__menu';
    menu.hidden = true;
    wrap.appendChild(menu);

    function currentLabel() {
      var o = select.options[select.selectedIndex];
      return o && o.value ? o.textContent : '';
    }
    input.value = currentLabel();

    var rendered = [];
    var activeIdx = -1;

    function buildMenu(filter) {
      menu.innerHTML = '';
      rendered = [];
      var q = (filter || '').trim().toLowerCase();
      var lastGroup = null;
      items.forEach(function (it) {
        if (q && it.label.toLowerCase().indexOf(q) === -1) return;
        if (it.group && it.group !== lastGroup) {
          var h = document.createElement('div');
          h.className = 'combo__group';
          h.textContent = it.group;
          menu.appendChild(h);
          lastGroup = it.group;
        }
        var b = document.createElement('div');
        b.className = 'combo__opt';
        b.textContent = it.label || '(geen)';
        if (it.value === select.value) b.classList.add('sel');
        b.addEventListener('mousedown', function (e) { e.preventDefault(); pick(it.value, it.label); });
        menu.appendChild(b);
        rendered.push(b);
      });
      if (!rendered.length) {
        var none = document.createElement('div');
        none.className = 'combo__empty';
        none.textContent = 'Niets gevonden';
        menu.appendChild(none);
      }
      activeIdx = -1;
    }

    function open(filter) { buildMenu(filter); menu.hidden = false; }
    function close() { menu.hidden = true; }
    function pick(value, label) {
      select.value = value;
      input.value = value ? label : '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    }
    function highlight(idx) {
      rendered.forEach(function (b, i) { b.classList.toggle('active', i === idx); });
      if (rendered[idx]) rendered[idx].scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('focus', function () { open(''); });
    input.addEventListener('input', function () { open(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (menu.hidden) open(''); activeIdx = Math.min(activeIdx + 1, rendered.length - 1); highlight(activeIdx); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlight(activeIdx); }
      else if (e.key === 'Enter') { if (!menu.hidden && rendered[activeIdx]) { e.preventDefault(); rendered[activeIdx].dispatchEvent(new MouseEvent('mousedown')); } }
      else if (e.key === 'Escape') { close(); }
    });
    input.addEventListener('blur', function () {
      setTimeout(function () { close(); if (input.value !== currentLabel()) input.value = currentLabel(); }, 130);
    });
  }
  document.querySelectorAll('select[data-combo]').forEach(enhanceCombo);

  // ---- Bevestiging vóór verzenden (data-confirm) ----------------------
  // Een submit-knop (of formulier) met data-confirm="..." vraagt eerst om
  // bevestiging. Deze listener staat vóór de spinner-listener, zodat een
  // geannuleerde bevestiging (e.defaultPrevented) het verzenden stopt.
  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    var src = (e.submitter && e.submitter.hasAttribute('data-confirm')) ? e.submitter
      : (form.hasAttribute('data-confirm')) ? form
      : form.querySelector('[data-confirm]');
    var msg = src && src.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // ---- Spinner + dubbel-verzenden voorkomen ---------------------------
  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return; // bv. een confirm() die geannuleerd is
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.hasAttribute('data-no-busy')) return;

    // Bulk-formulier: niets geselecteerd → niet verzenden.
    if (form.classList.contains('bulk-bar') &&
        form.querySelectorAll('input[data-bulk-item]:checked').length === 0) {
      e.preventDefault();
      var c = form.querySelector('[data-bulk-count]');
      if (c) { c.textContent = 'Selecteer eerst voorlichters'; }
      return;
    }

    if (form.dataset.submitting === '1') { e.preventDefault(); return; }
    form.dataset.submitting = '1';

    var btn = e.submitter || form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
    if (btn && btn.classList) {
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
    }
    // Vangnet: mocht navigatie uitblijven, knop na 8s weer vrijgeven.
    setTimeout(function () {
      form.dataset.submitting = '';
      if (btn && btn.classList) { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    }, 8000);
  });
})();
