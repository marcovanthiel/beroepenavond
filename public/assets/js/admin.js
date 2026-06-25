/* Beheer-paneel: kleine progressive-enhancement laag.
   - Direct zoeken/filteren in lijsten (geen herladen)
   - Spinner + dubbel-verzenden-beveiliging op formulieren
   Werkt volledig zonder JS (alles blijft server-side); dit maakt het alleen
   prettiger. */
(function () {
  'use strict';

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
        b.textContent = it.label || '— geen —';
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
