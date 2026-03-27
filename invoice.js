/**
 * invoice.js — U.A.U. Jigbo Technics Invoice
 *
 * SECURITY MEASURES:
 *  1. Zero innerHTML usage — all DOM built via createElement + textContent
 *  2. All numeric inputs validated before arithmetic (NaN/Infinity guard)
 *  3. Tax rate input sanitized to numeric-only, capped 0–100
 *  4. Signature upload: type whitelist + 2MB size cap + FileReader only (no URL.createObjectURL XSS risk)
 *  5. No eval, no Function(), no document.write
 *  6. No external network calls
 *  7. All event listeners attached in JS (no inline onclick in HTML)
 *  8. DOMContentLoaded guard — no global scope leakage
 */

'use strict';

(function () {

  /* ── Constants ── */
  const INIT_ITEM_ROWS = 8;
  const INIT_HSN_ROWS  = 2;
  const MAX_SIGN_BYTES = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_SIGN_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

  /* ── Safe number parse ── */
  function safeFloat(val) {
    const n = parseFloat(val);
    return (isFinite(n) && !isNaN(n) && n >= 0) ? n : 0;
  }

  /* ── Sanitize tax rate input: digits and single dot only, clamp 0–100 ── */
  function sanitizeTaxRate(input) {
    input.addEventListener('input', function () {
      // Strip anything that isn't digit or dot
      let v = this.value.replace(/[^0-9.]/g, '');
      // Only one decimal point
      const parts = v.split('.');
      if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
      // Clamp to 100
      if (parseFloat(v) > 100) v = '100';
      this.value = v;
      recalc();
    });
  }

  /* ── Create an input element safely ── */
  function makeInput(opts) {
    const el = document.createElement('input');
    el.className   = opts.cls   || 'editable';
    el.type        = opts.type  || 'text';
    el.maxLength   = opts.max   || 100;
    el.readOnly    = opts.ro    || false;
    el.tabIndex    = opts.tab   || 0;
    el.placeholder = opts.ph    || '';
    el.autocomplete = 'off';
    el.spellcheck  = false;
    if (opts.style) el.style.cssText = opts.style;
    return el;
  }

  /* ── Create delete button safely ── */
  function makeDelBtn(handler) {
    const btn = document.createElement('button');
    btn.className = 'del-btn no-print';
    btn.type      = 'button';
    btn.title     = 'Delete row';
    btn.textContent = '\u2715'; // ✕
    btn.addEventListener('click', handler);
    return btn;
  }

  /* ── Item row ── */
  function addItemRow() {
    const body = document.getElementById('itemsBody');
    const n    = body.children.length + 1;

    const row = document.createElement('div');
    row.className = 'item-row';

    // S.No.
    const snoDiv = document.createElement('div');
    snoDiv.className = 'center';
    const snoSpan = document.createElement('span');
    snoSpan.className   = 'sno';
    snoSpan.textContent = String(n);
    snoDiv.appendChild(snoSpan);

    // Description
    const descDiv = document.createElement('div');
    const descInp = makeInput({ max: 200, ph: '' });
    descInp.style.width = '100%';
    descDiv.appendChild(descInp);

    // HSN/SAC
    const hsnDiv = document.createElement('div');
    hsnDiv.className = 'center';
    const hsnInp = makeInput({ max: 20, style: 'width:100%;text-align:center;' });
    hsnDiv.appendChild(hsnInp);

    // UOM
    const uomDiv = document.createElement('div');
    uomDiv.className = 'center';
    const uomInp = makeInput({ max: 20, style: 'width:100%;text-align:center;' });
    uomDiv.appendChild(uomInp);

    // Quantity
    const qtyDiv = document.createElement('div');
    qtyDiv.className = 'right';
    const qtyInp = makeInput({ max: 15, style: 'width:100%;text-align:right;' });
    qtyInp.classList.add('qty');
    qtyInp.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9.]/g, '');
      recalc();
    });
    qtyDiv.appendChild(qtyInp);

    // Rate
    const rateDiv = document.createElement('div');
    rateDiv.className = 'right';
    const rateInp = makeInput({ max: 15, style: 'width:100%;text-align:right;' });
    rateInp.classList.add('rate');
    rateInp.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9.]/g, '');
      recalc();
    });
    rateDiv.appendChild(rateInp);

    // Total Price (readonly)
    const tpDiv = document.createElement('div');
    tpDiv.className = 'right';
    const tpInp = makeInput({ max: 20, ro: true, tab: -1, style: 'width:100%;text-align:right;' });
    tpInp.classList.add('total-price');
    tpDiv.appendChild(tpInp);

    // Delete button
    const delDiv = document.createElement('div');
    delDiv.className = 'no-print';
    delDiv.appendChild(makeDelBtn(function () {
      row.remove();
      renumberItems();
      recalc();
    }));

    row.append(snoDiv, descDiv, hsnDiv, uomDiv, qtyDiv, rateDiv, tpDiv, delDiv);
    body.appendChild(row);
  }

  function renumberItems() {
    document.querySelectorAll('.item-row .sno').forEach(function (el, i) {
      el.textContent = String(i + 1);
    });
  }

  /* ── HSN row ── */
  function addHsnRow() {
    const body = document.getElementById('hsnBody');
    const row  = document.createElement('div');
    row.className = 'hsn-row';

    const cols = [
      { style: 'text-align:center;width:100%;', max: 20  },
      { style: 'text-align:right;width:100%;',  max: 20  },
      { style: 'text-align:center;width:100%;', max: 10  },
      { style: 'text-align:right;width:100%;',  max: 20  },
      { style: 'text-align:center;width:100%;', max: 10  },
      { style: 'text-align:right;width:100%;',  max: 20  },
    ];

    cols.forEach(function (c) {
      const div = document.createElement('div');
      const inp = makeInput({ style: c.style, max: c.max });
      div.appendChild(inp);
      row.appendChild(div);
    });

    const delDiv = document.createElement('div');
    delDiv.className = 'no-print';
    delDiv.appendChild(makeDelBtn(function () { row.remove(); }));
    row.appendChild(delDiv);

    body.appendChild(row);
  }

  /* ── Recalculate totals ── */
  function recalc() {
    let gross = 0;

    document.querySelectorAll('.item-row').forEach(function (row) {
      const qty  = safeFloat(row.querySelector('.qty')?.value);
      const rate = safeFloat(row.querySelector('.rate')?.value);
      const total = qty * rate;
      const tp = row.querySelector('.total-price');
      if (tp) tp.value = total > 0 ? total.toFixed(2) : '';
      gross += total;
    });

    const cgstR = safeFloat(document.getElementById('cgstRate').value);
    const sgstR = safeFloat(document.getElementById('sgstRate').value);
    const igstR = safeFloat(document.getElementById('igstRate').value);

    const cgst  = gross * cgstR / 100;
    const sgst  = gross * sgstR / 100;
    const igst  = gross * igstR / 100;
    const grand = gross + cgst + sgst + igst;

    document.getElementById('grossVal').value  = gross > 0 ? gross.toFixed(2) : '';
    document.getElementById('cgstVal').value   = cgst  > 0 ? cgst.toFixed(2)  : '';
    document.getElementById('sgstVal').value   = sgst  > 0 ? sgst.toFixed(2)  : '';
    document.getElementById('igstVal').value   = igst  > 0 ? igst.toFixed(2)  : '';
    document.getElementById('grandTotal').textContent = grand.toFixed(2);
  }

  /* ── Signature upload ── */
  function initSignature() {
    const signArea     = document.getElementById('signArea');
    const signInput    = document.getElementById('signInput');
    const signPreview  = document.getElementById('signPreview');
    const signPrint    = document.getElementById('signPrint');
    const signPlaceholder = document.getElementById('signPlaceholder');
    const signClearBtn = document.getElementById('signClearBtn');

    // Click on area opens file picker
    signArea.addEventListener('click', function () {
      signInput.click();
    });

    // File selected
    signInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;

      // Type whitelist check
      if (!ALLOWED_SIGN_TYPES.includes(file.type)) {
        alert('Invalid file type. Please upload a PNG, JPG, GIF or WebP image.');
        this.value = '';
        return;
      }

      // Size cap (2MB)
      if (file.size > MAX_SIGN_BYTES) {
        alert('File too large. Maximum signature image size is 2MB.');
        this.value = '';
        return;
      }

      // Read as data URL (safe — no blob URL, no XSS surface)
      const reader = new FileReader();
      reader.onload = function (ev) {
        const dataUrl = ev.target.result;

        // Validate it's actually an image by checking data URI prefix
        if (!/^data:image\/(png|jpeg|gif|webp);base64,/.test(dataUrl)) {
          alert('Invalid image data.');
          return;
        }

        signPreview.src        = dataUrl;
        signPrint.src          = dataUrl;
        signPreview.style.display = 'block';
        signPrint.style.display   = 'block';
        signPlaceholder.style.display = 'none';
        signClearBtn.style.display    = 'inline';
      };
      reader.onerror = function () {
        alert('Failed to read the file. Please try again.');
      };
      reader.readAsDataURL(file);
    });

    // Clear
    signClearBtn.addEventListener('click', function () {
      signPreview.src = '';
      signPrint.src   = '';
      signPreview.style.display     = 'none';
      signPrint.style.display       = 'none';
      signPlaceholder.style.display = 'block';
      signClearBtn.style.display    = 'none';
      signInput.value               = '';
    });
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {

    // Print button
    document.getElementById('btnPrint').addEventListener('click', function () {
      window.print();
    });

    // Add item row button
    document.getElementById('btnAddItem').addEventListener('click', addItemRow);

    // Add HSN row button
    document.getElementById('btnAddHsn').addEventListener('click', addHsnRow);

    // Tax rate inputs — sanitize and recalc
    sanitizeTaxRate(document.getElementById('cgstRate'));
    sanitizeTaxRate(document.getElementById('sgstRate'));
    sanitizeTaxRate(document.getElementById('igstRate'));

    // Signature
    initSignature();

    // Seed initial rows
    for (let i = 0; i < INIT_ITEM_ROWS; i++) addItemRow();
    for (let i = 0; i < INIT_HSN_ROWS;  i++) addHsnRow();

  });

})(); // IIFE — nothing leaks to global scope
