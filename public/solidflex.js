/* ═══════════════════════════════════════════════════════════
   SOLID FLEX module — UI layer
   Namespaced: window.SF = {...}. All handlers attach via event
   delegation / window.SF, no changes to NAFAS functions.
   Requires: public/solidflex.css, AG Grid (lazy-loaded).
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── i18n: switch text by editing this dictionary (Bengali later) ──
  const STRINGS = {
    en: {
      solidflex: 'SOLID FLEX',
      module: 'Apparel Line',
      hubTitle: 'SOLID FLEX',
      hubDesc: 'T-Shirts · Drop Shoulder · POLO',
      sell: 'Sell', sellDesc: 'New sale entry',
      stock: 'Stock', stockDesc: 'Live stock per PID',
      shipment: 'Shipment', shipmentDesc: 'Record received items',
      cost: 'Cost', costDesc: 'Expenses & overhead',
      revenue: 'Revenue', revenueDesc: 'Profit & loss',
      team: 'Team', teamDesc: 'Seller performance',
      master: 'Master', masterDesc: 'Types, colors, designs, sizes',
      dashboard: 'Dashboard', dashboardDesc: 'Overview & top sellers',
      type: 'Type', color: 'Color', design: 'Design', size: 'Size',
      pid: 'PID', qty: 'Qty', price: 'Price', stockCol: 'Stock',
      customer: 'Customer', phone: 'Phone', seller: 'Seller', date: 'Date',
      note: 'Note', status: 'Status', received: 'Received',
      unitCost: 'Unit Cost', total: 'Total', save: 'Save', cancel: 'Cancel',
      createSale: 'Create Sale', addShipment: 'Add Shipment',
      saved: 'Saved ✓', saving: 'Saving…',
      lowOnly: 'Low stock only', allItems: 'All',
      history: 'History', void: 'Void',
      outOfStock: 'Out of stock',
      stockLeft: 'in stock',
      walkIn: 'Walk-in',
      invalidPid: 'Unknown PID — pick Type/Color/Design/Size above',
      pickAll4: 'Pick all four to build a PID',
      noData: 'No data yet',
    },
  };
  let LANG = localStorage.getItem('sf_lang') || 'en';
  const t = (k) => (STRINGS[LANG] && STRINGS[LANG][k]) || STRINGS.en[k] || k;

  // ── State ──
  const S = {
    masters: { type: [], color: [], design: [], size: [] }, // active values
    products: [],              // all products (lean + stock when available)
    grid: null,                // current AG Grid instance
    sell: { pid: '', qty: 1, price: null },
  };

  // ── API helper (reuses the app's JWT) ──
  async function api(path, opts = {}) {
    const res = await fetch(`/api/solidflex${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }

  // ── AG Grid Community loader (CDN, cached after first load) ──
  const AG_VERSION = '31.3.4';
  let agPromise = null;
  function loadAgGrid() {
    if (window.agGrid) return Promise.resolve();
    if (agPromise) return agPromise;
    const links = [
      ['link', `https://cdn.jsdelivr.net/npm/ag-grid-community@${AG_VERSION}/styles/ag-grid.min.css`],
      ['link', `https://cdn.jsdelivr.net/npm/ag-grid-community@${AG_VERSION}/styles/ag-theme-alpine.min.css`],
      ['script', `https://cdn.jsdelivr.net/npm/ag-grid-community@${AG_VERSION}/dist/ag-grid-community.min.js`],
    ];
    agPromise = Promise.all(links.map(([tag, src]) => new Promise((resolve, reject) => {
      const el = document.createElement(tag);
      if (tag === 'link') { el.rel = 'stylesheet'; el.href = src; }
      else { el.src = src; }
      el.onload = resolve;
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    })));
    return agPromise;
  }

  // ── Data loading ──
  async function loadMasters() {
    const items = await api('/master');
    S.masters = { type: [], color: [], design: [], size: [] };
    for (const m of items) {
      if (m.isActive && S.masters[m.kind]) S.masters[m.kind].push(m.value);
    }
  }

  async function loadProducts() {
    S.products = await api('/products?withStock=true');
  }

  function productByPid(pid) {
    return S.products.find(p => p.pid === pid) || null;
  }

  // ── Helpers ──
  const el = (id) => document.getElementById(id);
  const money = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function destroyGrid() {
    if (S.grid) { try { S.grid.destroy(); } catch (e) { /* noop */ } S.grid = null; }
  }

  /** Build a desktop AG Grid, or fall back to cards on mobile */
  function gridOrCards(container, gridOptions, cardsHtmlFn) {
    if (isMobile()) {
      destroyGrid();
      container.innerHTML = `<div class="sf-cards">${cardsHtmlFn()}</div>`;
      return null;
    }
    return createGrid(container, gridOptions);
  }

  async function createGrid(container, gridOptions) {
    await loadAgGrid();
    container.innerHTML = '<div class="ag-theme-alpine sf-grid" style="width:100%;height:100%"></div>';
    const gridDiv = container.firstElementChild;
    gridOptions.defaultColDef = {
      resizable: true, sortable: true, filter: true,
      ...(gridOptions.defaultColDef || {}),
    };
    S.grid = window.agGrid.createGrid(gridDiv, gridOptions);
    return S.grid;
  }

  function setSaved(msg) {
    const s = el('sf-saved');
    if (s) { s.textContent = msg || t('saved'); setTimeout(() => { s.textContent = ''; }, 2500); }
  }

  // ═══════════════ VIEW: HUB ═══════════════
  function renderHub() {
    destroyGrid();
    const cards = [
      { id: 'sell', icon: '🛒', perm: null },
      { id: 'stock', icon: '📦', perm: null },
      { id: 'shipment', icon: '🚚', perm: 'sfManageShipments' },
      { id: 'cost', icon: '💸', perm: 'sfManageExpenses', adminOnly: true },
      { id: 'revenue', icon: '📈', perm: null },
      { id: 'team', icon: '👥', perm: null },
      { id: 'master', icon: '🧩', perm: 'sfManageMasters' },
      { id: 'dashboard', icon: '📊', perm: null },
    ].filter(c => {
      if (c.adminOnly) return role === 'admin';
      if (c.perm) return role === 'admin' || userPerms?.[c.perm];
      return true;
    });

    el('main-content').innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div>
            <div class="sf-title">${t('hubTitle')} <span class="sf-badge">SF</span></div>
            <div class="sf-sub">${t('hubDesc')}</div>
          </div>
        </div>
        <div class="sf-hub">
          ${cards.map(c => `
            <button class="sf-hub-card" data-sf-open="${c.id}">
              <div class="sf-hub-icon">${c.icon}</div>
              <div class="sf-hub-name">${t(c.id)}</div>
              <div class="sf-hub-desc">${t(c.id + 'Desc')}</div>
            </button>`).join('')}
        </div>
      </div>`;
  }

  // ═══════════════ VIEW: STOCK ═══════════════
  async function renderStock(lowOnly = false) {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;

    try {
      const data = await api('/reports/stock');
      let rows = data.rows;
      if (lowOnly) rows = rows.filter(r => r.isLow);
      S._stockRows = rows;

      const header = `
        <div class="sf-brandbar">
          <div>
            <div class="sf-title">📦 ${t('stock')}</div>
            <div class="sf-sub">${data.summary.totalUnits} units · ${data.summary.lowStockCount} low · ${data.summary.activeProducts} products</div>
          </div>
          <div class="sf-actions">
            <button class="btn btn-outline btn-sm" id="sf-stock-filter">${lowOnly ? t('allItems') : t('lowOnly')}</button>
            <button class="btn btn-outline btn-sm" data-sf-export="stock">⬇ CSV</button>
          </div>
        </div>`;

      const body = el('sf-view-body') || wrap.querySelector('.sf-wrap');
      body.innerHTML = header + `<div id="sf-stock-body" style="min-height:300px"></div>`;

      const stockCell = (r) => `<span class="sf-stock-chip ${r.stock <= 0 ? 'zero' : r.isLow ? 'low' : 'ok'}">${r.stock}</span>`;
      const colDefs = [
        { headerName: t('pid'), field: 'pid', cellClass: 'sf-cell-pid', flex: 2, minWidth: 240, cellRenderer: p => esc(p.value) },
        { headerName: t('type'), field: 'type', width: 110 },
        { headerName: t('color'), field: 'color', width: 100 },
        { headerName: t('design'), field: 'design', width: 100 },
        { headerName: t('size'), field: 'size', width: 80 },
        { headerName: t('stockCol'), field: 'stock', width: 100, cellClass: p => (p.data.stock <= 0 ? 'sf-cell-low' : p.data.isLow ? 'sf-cell-low' : 'sf-cell-ok'), sort: 'desc' },
        { headerName: 'Alert ≤', field: 'lowStockThreshold', width: 90 },
      ];

      gridOrCards(
        el('sf-stock-body'),
        {
          columnDefs: colDefs,
          rowData: rows,
          rowSelection: 'single',
          quickFilterText: '',
          getRowStyle: p => (p.data.isLow ? { background: 'rgba(255,59,48,0.05)' } : null),
        },
        () => rows.map(r => `
          <div class="sf-card">
            <div class="sf-card-top">
              <div class="sf-card-pid">${esc(r.pid)}</div>
              ${stockCell(r)}
            </div>
            <div class="sf-card-meta">${esc(r.type)} · ${esc(r.color)} · ${esc(r.design)} · ${esc(r.size)} — alert ≤ ${r.lowStockThreshold}</div>
          </div>`).join('') || `<div class="empty-state"><div class="empty-text">${t('noData')}</div></div>`
      );

      el('sf-stock-filter').onclick = () => renderStock(!lowOnly);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ═══════════════ VIEW: SHIPMENT ═══════════════
  async function renderShipment() {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;

    try {
      const [shipments] = await Promise.all([api('/shipments'), loadProducts().catch(() => { })]);
      S._shipments = shipments;

      const formHtml = `
        <div class="card sf-card">
          <div class="card-title">🚚 ${t('addShipment')}</div>
          <div class="sf-sell-form">
            <div class="sf-cascade">
              <div>
                <label class="form-label">${t('pid')}</label>
                <select class="form-select" id="sf-shp-pid">
                  <option value="">— select product —</option>
                  ${S.products.filter(p => p.isActive).map(p => `<option value="${esc(p.pid)}">${esc(p.pid)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">${t('qty')}</label>
                <input class="form-input" type="number" id="sf-shp-qty" min="1" step="1" value="10" />
              </div>
            </div>
            <div style="margin-top:0.5rem">
              <label class="form-label">${t('note')}</label>
              <input class="form-input" id="sf-shp-note" placeholder="e.g. Carton #4 from factory" />
            </div>
            <div class="sf-field-err" id="sf-shp-err"></div>
            <button class="btn btn-primary btn-block" id="sf-shp-save" style="margin-top:0.5rem">✓ ${t('addShipment')}</button>
          </div>
        </div>`;

      const header = `
        <div class="sf-brandbar">
          <div>
            <div class="sf-title">🚚 ${t('shipment')}</div>
            <div class="sf-sub">${t('history')}: ${shipments.length}</div>
          </div>
          <div class="sf-actions">
            <button class="btn btn-outline btn-sm" data-sf-export="shipments">⬇ CSV</button>
          </div>
        </div>`;

      wrap.innerHTML = `<div class="sf-wrap">${header}${formHtml}<div id="sf-shp-body" style="min-height:280px"></div><div class="sf-saved" id="sf-saved"></div></div>`;

      el('sf-shp-save').onclick = saveShipment;

      const colDefs = [
        { headerName: t('date'), field: 'date', width: 150, valueFormatter: p => new Date(p.value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }), sort: 'desc' },
        { headerName: t('pid'), field: 'pid', cellClass: 'sf-cell-pid', flex: 2, minWidth: 220, cellRenderer: p => esc(p.value) },
        { headerName: t('qty'), field: 'qty', width: 90 },
        { headerName: t('note'), field: 'note', flex: 1, minWidth: 140, cellRenderer: p => esc(p.value || '—') },
        { headerName: t('received'), field: 'receivedBy', width: 110 },
        { headerName: t('status'), field: 'voided', width: 90, cellRenderer: p => p.value ? '<span class="sf-stock-chip low">VOID</span>' : '<span class="sf-stock-chip ok">OK</span>' },
        {
          headerName: '', width: 80, sortable: false, filter: false,
          cellRenderer: p => p.data.voided ? '' : `<button class="btn btn-danger btn-sm sf-void-btn" data-sf-void-shp="${p.data._id}" title="${t('void')}">✕</button>`,
        },
      ];

      gridOrCards(
        el('sf-shp-body'),
        { columnDefs: colDefs, rowData: shipments },
        () => shipments.map(s => `
          <div class="sf-card">
            <div class="sf-card-top">
              <div class="sf-card-pid">${esc(s.pid)}</div>
              ${s.voided ? '<span class="sf-stock-chip low">VOID</span>' : `<button class="btn btn-danger btn-sm sf-void-btn" data-sf-void-shp="${s._id}">✕</button>`}
            </div>
            <div class="sf-card-meta">+${s.qty} · ${new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${esc(s.note || '—')}</div>
          </div>`).join('') || `<div class="empty-state"><div class="empty-text">${t('noData')}</div></div>`
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveShipment() {
    const errEl = el('sf-shp-err');
    errEl.textContent = '';
    const pid = el('sf-shp-pid').value;
    const qty = parseInt(el('sf-shp-qty').value, 10);
    if (!pid) { errEl.textContent = 'Select a product'; return; }
    if (!Number.isInteger(qty) || qty < 1) { errEl.textContent = 'Qty must be a whole number ≥ 1'; return; }

    try {
      await api('/shipments', { method: 'POST', body: JSON.stringify({ pid, qty, note: el('sf-shp-note').value }) });
      setSaved();
      showToast(`✓ +${qty} ${pid}`, 'success');
      renderShipment();
    } catch (err) {
      errEl.textContent = err.message;
      showToast(err.message, 'error');
    }
  }

  async function voidShipment(id) {
    if (!confirm('Void this shipment? Stock will be reduced.')) return;
    try {
      await api(`/shipments/${id}/void`, { method: 'PATCH' });
      showToast('Shipment voided', 'success');
      renderShipment();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ═══════════════ CSV export (client-side) ═══════════════
  function exportCsv(kind) {
    let rows, cols, name;
    if (kind === 'stock') {
      rows = S._stockRows || [];
      cols = ['pid', 'type', 'color', 'design', 'size', 'stock', 'lowStockThreshold'];
      name = 'SF_Stock';
    } else if (kind === 'shipments') {
      rows = S._shipments || [];
      cols = ['date', 'pid', 'qty', 'note', 'receivedBy', 'voided'];
      name = 'SF_Shipments';
    } else return;
    const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => escCsv(r[c])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ═══════════════ ROUTER ═══════════════
  const VIEWS = {
    hub: renderHub,
    stock: () => renderStock(false),
    shipment: renderShipment,
    sell: renderSell,
  };
  const COMING_SOON = {
    cost: ['💸', 'Cost', 'Phase 3 — per-PID & overhead expenses'],
    revenue: ['📈', 'Revenue', 'Phase 3 — revenue, cost & profit with date filters'],
    team: ['👥', 'Team', 'Phase 3 — per-seller performance'],
    master: ['🧩', 'Master', 'Phase 3 — manage Types, Colors, Designs, Sizes'],
    dashboard: ['📊', 'Dashboard', 'Phase 3 — totals, top sellers & recent sales'],
  };
  let currentSfView = 'hub';

  function open(view) {
    currentSfView = view;
    const fn = VIEWS[view];
    if (fn) { fn(); return; }
    const soon = COMING_SOON[view];
    if (soon) {
      destroyGrid();
      el('main-content').innerHTML = `
        <div class="sf-wrap">
          <div class="sf-title">${soon[0]} ${soon[1]}</div>
          <div class="card" style="text-align:center;padding:2rem 1rem">
            <div style="font-size:2rem">🚧</div>
            <div style="font-weight:600;margin-top:0.5rem">${soon[1]} screen arrives in ${soon[2].split('—')[0].trim()}</div>
            <div class="sf-hint" style="margin-top:0.3rem">${soon[2].split('—')[1]?.trim() || ''}</div>
            <button class="btn btn-outline btn-sm" style="margin-top:1rem" data-sf-open="hub">← Back</button>
          </div>
        </div>`;
    }
  }

  // ═══════════════ VIEW: SELL ═══════════════
  const CART_KEY = 'sf_cart';

  function loadCart() {
    try { S.cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { S.cart = []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(S.cart)); } catch (e) { /* noop */ }
  }

  function cascadedOptions(picked) {
    // Options narrow based on what's already picked AND actually exists as a product
    const pool = S.products.filter(p => p.isActive);
    const opt = (key) => {
      let list = pool;
      for (const k of ['type', 'color', 'design']) {
        if (k === key) break;
        if (picked[k]) list = list.filter(p => p[k] === picked[k]);
      }
      return [...new Set(list.map(p => p[key]))];
    };
    return { type: opt('type'), color: opt('color'), design: opt('design'), size: opt('size') };
  }

  function matchProduct(picked) {
    return S.products.find(p =>
      p.isActive && p.type === picked.type && p.color === picked.color &&
      p.design === picked.design && p.size === picked.size) || null;
  }

  async function renderSell() {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;

    try {
      await loadProducts();
      loadCart();
      const picked = { type: '', color: '', design: '', size: '' };
      S._sellPicked = picked;

      const isSellerOnly = role !== 'admin' && !userPerms?.sfManageShipments;

      wrap.innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div>
            <div class="sf-title">🛒 ${t('sell')}</div>
            <div class="sf-sub"><span id="sf-saved"></span></div>
          </div>
        </div>

        <div class="card sf-card sf-sell-form">
          <div class="sf-cascade">
            <div>
              <label class="form-label">${t('type')}</label>
              <select class="form-select" id="sf-s-type"><option value="">—</option></select>
            </div>
            <div>
              <label class="form-label">${t('color')}</label>
              <select class="form-select" id="sf-s-color"><option value="">—</option></select>
            </div>
            <div>
              <label class="form-label">${t('design')}</label>
              <select class="form-select" id="sf-s-design"><option value="">—</option></select>
            </div>
            <div>
              <label class="form-label">${t('size')}</label>
              <select class="form-select" id="sf-s-size"><option value="">—</option></select>
            </div>
          </div>

          <div style="margin-top:0.6rem">
            <label class="form-label">${t('pid')} — type or pick to autofill</label>
            <input class="form-input" id="sf-s-pid" list="sf-pid-list" placeholder="TSHIRT-BLACK-ABC-M" autocomplete="off" />
            <datalist id="sf-pid-list">
              ${S.products.filter(p => p.isActive).map(p => `<option value="${esc(p.pid)}">${esc(p.type)} · stock ${p.stock ?? '?'}${p.unit ? '' : ''}</option>`).join('')}
            </datalist>
            <div class="sf-hint" id="sf-s-pidhint">${t('pickAll4')}</div>
          </div>

          <div id="sf-s-stockbox"></div>

          <div class="sf-qty-row" style="margin-top:0.6rem">
            <button class="btn btn-outline qty-btn" id="sf-s-dec">−</button>
            <input class="form-input" type="number" id="sf-s-qty" min="1" step="1" value="1" />
            <button class="btn btn-outline qty-btn" id="sf-s-inc">+</button>
            <div style="flex:1">
              <label class="form-label" style="margin:0">${t('price')} ৳</label>
              <input class="form-input" type="number" id="sf-s-price" min="0" placeholder="auto" />
            </div>
          </div>

          <div class="sf-cascade" style="margin-top:0.6rem">
            <div>
              <label class="form-label">${t('customer')}</label>
              <input class="form-input" id="sf-s-customer" placeholder="${t('walkIn')}" />
            </div>
            <div>
              <label class="form-label">${t('phone')}</label>
              <input class="form-input" id="sf-s-phone" placeholder="Optional" />
            </div>
          </div>
          ${!isSellerOnly ? `
          <div style="margin-top:0.6rem">
            <label class="form-label">${t('seller')}</label>
            <input class="form-input" id="sf-s-seller" placeholder="${esc(userName || 'Staff')}" />
          </div>` : ''}
          <div class="sf-field-err" id="sf-s-err"></div>
          <button class="btn btn-primary btn-block" id="sf-s-add" style="margin-top:0.6rem;font-size:1rem;padding:0.9rem">+ Add to Sale</button>
        </div>

        <div class="sf-sell-total">
          <span style="font-size:0.8rem;color:var(--text-muted)">${t('total')} (<span id="sf-s-count">0</span> items)</span>
          <span class="sf-amount" id="sf-s-total">৳0</span>
        </div>
        <button class="btn btn-primary btn-block" id="sf-s-submit" style="padding:0.95rem;font-size:1rem">✓ Record Sale</button>
        <div id="sf-s-cart"></div>
      </div>`;

      // --- cascade wiring (one listener per select, rebuilt options per change) ---
      const selects = { type: el('sf-s-type'), color: el('sf-s-color'), design: el('sf-s-design'), size: el('sf-s-size') };
      function refreshCascade(changed) {
        const opts = cascadedOptions(picked);
        for (const k of ['type', 'color', 'design', 'size']) {
          if (k === changed) continue;
          const keep = picked[k];
          selects[k].innerHTML = `<option value="">—</option>` +
            opts[k].map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
          if (keep && opts[k].includes(keep)) selects[k].value = keep;
          else picked[k] = '';
        }
        onPickChange();
      }
      for (const k of ['type', 'color', 'design', 'size']) {
        selects[k].addEventListener('change', () => { picked[k] = selects[k].value; refreshCascade(k); });
      }
      refreshCascade();

      // --- PID → fields autofill ---
      el('sf-s-pid').addEventListener('change', () => {
        const raw = el('sf-s-pid').value.trim().toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
        const parts = raw.split('-');
        if (parts.length !== 4) return;
        const [ty, co, de, si] = parts;
        picked.type = ''; picked.color = ''; picked.design = ''; picked.size = '';
        refreshCascade('x'); // full rebuild from empty picks
        // Accept each segment only if it exists in the current option list
        const apply = (k, v) => {
          if (v && selects[k].querySelector(`option[value="${CSS.escape(v)}"]`)) picked[k] = v;
        };
        apply('type', ty); apply('color', co); apply('design', de); apply('size', si);
        refreshCascade('x'); // rebuild again → syncs every select's visible value
        onPickChange();
      });

      // --- qty / price / stock ---
      el('sf-s-dec').onclick = () => stepQty(-1);
      el('sf-s-inc').onclick = () => stepQty(1);
      el('sf-s-qty').addEventListener('input', updatePreview);
      el('sf-s-price').addEventListener('input', updatePreview);

      el('sf-s-add').onclick = addToCart;
      el('sf-s-submit').onclick = submitCart;

      renderCart();
      updatePreview();

      function stepQty(d) {
        const inp = el('sf-s-qty');
        const v = Math.max(1, (parseInt(inp.value, 10) || 1) + d);
        inp.value = v;
        updatePreview();
      }

      function onPickChange() {
        const p = matchProduct(picked);
        const hint = el('sf-s-pidhint');
        const box = el('sf-s-stockbox');
        if (p) {
          el('sf-s-pid').value = p.pid;
          hint.textContent = `${p.label || p.pid}`;
          const stock = Number.isInteger(p.stock) ? p.stock : (S._stockMap?.[p.pid] ?? '?');
          box.innerHTML = stock !== '?' && stock !== undefined
            ? `<div class="sf-hint">${t('stockCol')}: <b>${stock}</b> ${t('stockLeft')}</div>${stock <= 0 ? `<div class="sf-zero-note">⚠️ ${t('outOfStock')} — record a shipment first</div>` : ''}`
            : '';
          if (!el('sf-s-price').value) el('sf-s-price').value = p.sellingPrice || '';
        } else {
          const allSet = picked.type && picked.color && picked.design && picked.size;
          hint.textContent = allSet ? t('invalidPid') : t('pickAll4');
          if (!el('sf-s-pid').dataset.typing) el('sf-s-pid').value = allSet ? [picked.type, picked.color, picked.design, picked.size].join('-') : el('sf-s-pid').value;
        }
        updatePreview();
      }
      S._onPickChange = onPickChange;

      function updatePreview() { renderCartTotals(); }

      function addToCart() {
        const errEl = el('sf-s-err');
        errEl.textContent = '';
        const p = matchProduct(picked);
        if (!p) { errEl.textContent = t('invalidPid'); return; }
        const qty = parseInt(el('sf-s-qty').value, 10);
        if (!Number.isInteger(qty) || qty < 1) { errEl.textContent = 'Qty must be ≥ 1'; return; }
        const price = el('sf-s-price').value === '' ? p.sellingPrice : Number(el('sf-s-price').value);
        if (!Number.isFinite(price) || price < 0) { errEl.textContent = 'Invalid price'; return; }
        const stock = p.stock;
        if (Number.isInteger(stock) && stock < qty) { errEl.textContent = `Only ${stock} ${t('stockLeft')}`; return; }

        const existing = S.cart.find(l => l.pid === p.pid);
        if (existing) { existing.qty += qty; existing.price = price; }
        else S.cart.push({ pid: p.pid, qty, price, name: p.label || p.pid });
        saveCart();
        renderCart();
        setSaved();
        showToast(`✓ ${p.pid} ×${qty} added`, 'success');
        // reset qty to 1 for fast next entry, keep selections
        el('sf-s-qty').value = 1;
      }
      S._addToCart = addToCart;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderCartTotals() {
    const count = S.cart.reduce((s, l) => s + l.qty, 0);
    const total = S.cart.reduce((s, l) => s + l.qty * l.price, 0);
    if (el('sf-s-count')) el('sf-s-count').textContent = count;
    if (el('sf-s-total')) el('sf-s-total').textContent = money(total);
  }

  function renderCart() {
    const box = el('sf-s-cart');
    if (!box) return;
    renderCartTotals();
    if (!S.cart.length) { box.innerHTML = ''; return; }

    const colDefs = [
      { headerName: t('pid'), field: 'pid', cellClass: 'sf-cell-pid', flex: 2, minWidth: 200, cellRenderer: p => esc(p.value) },
      {
        headerName: t('qty'), field: 'qty', width: 110, editable: true, type: 'rightAligned',
        cellClass: 'sf-inline-err-wrap',
        valueParser: p => Math.max(1, parseInt(p.newValue, 10) || 1),
      },
      { headerName: `${t('price')} ৳`, field: 'price', width: 110, editable: true, type: 'rightAligned', valueParser: p => Math.max(0, Number(p.newValue) || 0) },
      { headerName: t('total'), width: 110, type: 'rightAligned', valueGetter: p => p.data.qty * p.data.price, valueFormatter: p => money(p.value) },
      { headerName: '', width: 70, sortable: false, filter: false, cellRenderer: p => `<button class="btn btn-danger btn-sm sf-void-btn" data-sf-cart-rm="${p.data.pid}">✕</button>` },
    ];

    gridOrCards(
      box,
      {
        columnDefs: colDefs,
        rowData: [...S.cart],
        stopEditingWhenCellsLoseFocus: true,
        onCellValueChanged: (e) => {
          const line = S.cart.find(l => l.pid === e.data.pid);
          if (line) { line[e.colDef.field] = e.data[e.colDef.field]; saveCart(); renderCartTotals(); }
        },
      },
      () => S.cart.map((l, i) => `
        <div class="sf-card">
          <div class="sf-card-top">
            <div class="sf-card-pid">${esc(l.pid)}</div>
            <button class="btn btn-danger btn-sm sf-void-btn" data-sf-cart-rm="${i}">✕</button>
          </div>
          <div class="sf-qty-row" style="margin-top:0.5rem">
            <button class="btn btn-outline qty-btn" data-sf-cart-dec="${i}">−</button>
            <input class="form-input" type="number" min="1" value="${l.qty}" data-sf-cart-qty="${i}" />
            <button class="btn btn-outline qty-btn" data-sf-cart-inc="${i}">+</button>
            <input class="form-input" type="number" min="0" value="${l.price}" data-sf-cart-price="${i}" style="width:90px" />
            <b style="margin-left:auto">${money(l.qty * l.price)}</b>
          </div>
        </div>`).join('')
    );
  }

  async function submitCart() {
    if (!S.cart.length) { showToast('Cart is empty — add items first', 'error'); return; };
    const btn = el('sf-s-submit');
    btn.disabled = true; btn.textContent = t('saving');
    const customerName = el('sf-s-customer')?.value || '';
    const customerPhone = el('sf-s-phone')?.value || '';
    const seller = el('sf-s-seller')?.value || '';
    const remaining = [];
    let okCount = 0;

    for (const line of S.cart) {
      try {
        await api('/sales', {
          method: 'POST',
          body: JSON.stringify({
            pid: line.pid, qty: line.qty, price: line.price,
            customerName, customerPhone, ...(seller ? { seller } : {}),
          }),
        });
        okCount++;
      } catch (err) {
        remaining.push(line);
        showToast(`✕ ${line.pid}: ${err.message}`, 'error');
        break; // stop on first failure; keep the rest in cart
      }
    }

    S.cart = remaining;
    saveCart();
    btn.disabled = false; btn.textContent = '✓ Record Sale';
    if (okCount) {
      setSaved(`✓ ${okCount} line(s) sold`);
      showToast(`✓ Sale recorded (${okCount} line${okCount > 1 ? 's' : ''})`, 'success');
    }
    renderCart();
  }

  function removeFromCart(key) {
    const idx = Number.isInteger(+key) ? +key : S.cart.findIndex(l => l.pid === key);
    if (idx >= 0 && idx < S.cart.length) {
      S._lastRemoved = { line: S.cart[idx], idx };
      S.cart.splice(idx, 1);
      saveCart();
      renderCart();
      // Undo affordance (spec §4)
      const u = document.createElement('button');
      u.className = 'btn btn-outline btn-sm'; u.textContent = '↩ Undo remove';
      u.onclick = () => {
        if (S._lastRemoved) { S.cart.splice(S._lastRemoved.idx, 0, S._lastRemoved.line); S._lastRemoved = null; saveCart(); renderCart(); u.remove(); }
      };
      const sub = el('sf-s-submit');
      if (sub) sub.after(u);
      setTimeout(() => u.remove(), 6000);
    }
  }

  function bumpCartQty(key, d) {
    const l = Number.isInteger(+key) ? S.cart[+key] : S.cart.find(x => x.pid === key);
    if (!l) return;
    l.qty = Math.max(1, l.qty + d);
    saveCart(); renderCart();
  }

  function setCartQty(key, v) {
    const l = Number.isInteger(+key) ? S.cart[+key] : S.cart.find(x => x.pid === key);
    if (!l) return;
    l.qty = Math.max(1, parseInt(v, 10) || 1);
    saveCart(); renderCartTotals();
  }

  function setCartPrice(key, v) {
    const l = Number.isInteger(+key) ? S.cart[+key] : S.cart.find(x => x.pid === key);
    if (!l) return;
    l.price = Math.max(0, Number(v) || 0);
    saveCart(); renderCartTotals();
  }

  // ═══════════════ GLOBAL API + EVENT DELEGATION ═══════════════
  window.SF = { open, t, refresh: () => open(currentSfView) };

  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-sf-open]');
    if (openBtn) { open(openBtn.dataset.sfOpen); return; }
    const voidBtn = e.target.closest('[data-sf-void-shp]');
    if (voidBtn) { voidShipment(voidBtn.dataset.sfVoidShp); return; }
    const expBtn = e.target.closest('[data-sf-export]');
    if (expBtn) { exportCsv(expBtn.dataset.sfExport); return; }
    const rmBtn = e.target.closest('[data-sf-cart-rm]');
    if (rmBtn) { removeFromCart(rmBtn.dataset.sfCartRm); return; }
    const decBtn = e.target.closest('[data-sf-cart-dec]');
    if (decBtn) { bumpCartQty(decBtn.dataset.sfCartDec, -1); return; }
    const incBtn = e.target.closest('[data-sf-cart-inc]');
    if (incBtn) { bumpCartQty(incBtn.dataset.sfCartInc, 1); return; }
  });

  document.addEventListener('change', (e) => {
    const q = e.target.closest('[data-sf-cart-qty]');
    if (q) { setCartQty(q.dataset.sfCartQty, q.value); return; }
    const p = e.target.closest('[data-sf-cart-price]');
    if (p) { setCartPrice(p.dataset.sfCartPrice, p.value); return; }
  });

  // Re-render on orientation change if inside a SF view
  let lastMobile = isMobile();
  window.addEventListener('resize', () => {
    if (isMobile() !== lastMobile) {
      lastMobile = isMobile();
      if (currentSfView !== 'hub') open(currentSfView);
    }
  });

  // ═══════════════ PART 2 INJECTION POINT ═══════════════
  // (Sell screen code is appended below)
})();
