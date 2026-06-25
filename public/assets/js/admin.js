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
