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
    if (!res.ok) {
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
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
    S._allMasters = items; // full list incl. inactive (Master screen)
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
      { id: 'cost', icon: '💸', adminOnly: true }, // expenses are Owner-only (server enforces too)
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
    } else if (kind === 'expenses') {
      rows = S._expenses || [];
      cols = ['date', 'scope', 'pid', 'category', 'amount', 'voided', 'note'];
      name = 'SF_Expenses';
    } else if (kind === 'team') {
      rows = S._team || [];
      cols = ['seller', 'unitsSold', 'totalSalesValue', 'cashCollected', 'salesCount'];
      name = 'SF_Team';
    } else if (kind === 'revenue') {
      rows = S._revenue ? [S._revenue] : [];
      cols = ['revenue', 'units', 'salesCount', 'cogs', 'overhead', 'perPidCost', 'cost', 'profit'];
      name = 'SF_Revenue';
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

  // ═══════════════ shared date-range helper ═══════════════
  function rangeParams(preset, custom = {}) {
    const now = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    if (preset === 'today') return { from: fmt(now), to: fmt(now) };
    if (preset === 'week') { const s = new Date(now); s.setDate(now.getDate() - 6); return { from: fmt(s), to: fmt(now) }; }
    if (preset === 'month') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    if (preset === 'custom') return { from: custom.from || '', to: custom.to || '' };
    return {}; // all
  }

  function rangeBarHtml(state) {
    return `
      <div class="period-tabs">
        ${['today', 'week', 'month', 'all'].map(p => `<button class="period-tab ${state.preset === p ? 'active' : ''}" data-sf-range="${p}">${{ today: 'Today', week: '7 Days', month: 'This Month', all: 'All' }[p]}</button>`).join('')}
      </div>`;
  }

  // ═══════════════ VIEW: COST (Owner only) ═══════════════
  async function renderCost() {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;
    if (!S._costState) S._costState = { preset: 'month', from: '', to: '' };
    const st = S._costState;

    try {
      await loadProducts().catch(() => { });
      const q = new URLSearchParams(rangeParams(st.preset, st));
      const expenses = await api('/expenses?' + q.toString());
      S._expenses = expenses;
      const perPid = expenses.filter(e => e.scope === 'per_pid');
      const overhead = expenses.filter(e => e.scope === 'overhead');
      const sum = (l) => l.filter(e => !e.voided).reduce((s, e) => s + e.amount, 0);

      const expRow = (e) => `
        <div class="sf-card">
          <div class="sf-card-top">
            <div class="sf-card-pid">${esc(e.scope === 'per_pid' ? e.pid : e.category)}</div>
            <div style="display:flex;align-items:center;gap:0.4rem">
              <b style="color:var(--danger)">${money(e.amount)}</b>
              ${e.voided ? '<span class="sf-stock-chip low">VOID</span>' : `<button class="btn btn-danger btn-sm sf-void-btn" data-sf-void-exp="${e._id}">✕</button>`}
            </div>
          </div>
          <div class="sf-card-meta">${new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${esc(e.category)}${e.note ? ' · ' + esc(e.note) : ''}</div>
        </div>`;

      const pidOptions = S.products.filter(p => p.isActive).map(p => `<option value="${esc(p.pid)}">${esc(p.pid)}</option>`).join('');

      wrap.innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div>
            <div class="sf-title">💸 ${t('cost')} <span class="sf-badge">Owner</span></div>
            <div class="sf-sub">Per-PID: ${money(sum(perPid))} · Overhead: ${money(sum(overhead))}</div>
          </div>
          <div class="sf-actions"><button class="btn btn-outline btn-sm" data-sf-export="expenses">⬇ CSV</button></div>
        </div>
        ${rangeBarHtml(st)}

        <div class="card sf-card">
          <div class="card-title">➕ Record Expense</div>
          <div class="sf-cascade">
            <div>
              <label class="form-label">Type</label>
              <select class="form-select" id="sf-cx-scope">
                <option value="overhead">Overhead (ads, rent, shipping…)</option>
                <option value="per_pid">Per-PID (cost tied to one product)</option>
              </select>
            </div>
            <div id="sf-cx-pidbox" style="display:none">
              <label class="form-label">${t('pid')}</label>
              <select class="form-select" id="sf-cx-pid"><option value="">—</option>${pidOptions}</select>
            </div>
          </div>
          <div class="sf-cascade" style="margin-top:0.5rem">
            <div>
              <label class="form-label">Amount ৳</label>
              <input class="form-input" type="number" id="sf-cx-amount" min="1" placeholder="0" />
            </div>
            <div>
              <label class="form-label">Category</label>
              <select class="form-select" id="sf-cx-cat">
                ${['Shipping', 'Ads', 'Rent', 'Utilities', 'Salary', 'Packaging', 'Photoshoot', 'Maintenance', 'Other'].map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="margin-top:0.5rem">
            <label class="form-label">${t('note')}</label>
            <input class="form-input" id="sf-cx-note" placeholder="Optional" />
          </div>
          <div class="sf-field-err" id="sf-cx-err"></div>
          <button class="btn btn-primary btn-block" id="sf-cx-save" style="margin-top:0.5rem">✓ ${t('save')}</button>
        </div>

        <div class="card sf-card"><div class="card-title">Per-PID costs (${perPid.length})</div>
          ${perPid.length ? perPid.map(expRow).join('') : `<div class="sf-hint">${t('noData')}</div>`}
        </div>
        <div class="card sf-card"><div class="card-title">Overhead (${overhead.length})</div>
          ${overhead.length ? overhead.map(expRow).join('') : `<div class="sf-hint">${t('noData')}</div>`}
        </div>
        <div class="sf-saved" id="sf-saved"></div>
      </div>`;

      el('sf-cx-scope').addEventListener('change', () => {
        el('sf-cx-pidbox').style.display = el('sf-cx-scope').value === 'per_pid' ? '' : 'none';
      });
      el('sf-cx-save').onclick = saveExpense;
    } catch (err) {
      if (err.status === 403) {
        wrap.innerHTML = `<div class="sf-wrap"><div class="card" style="text-align:center;padding:2rem"><div style="font-size:2rem">🔒</div><div style="margin-top:0.5rem">Expenses are Owner-only</div></div></div>`;
      } else showToast(err.message, 'error');
    }
  }

  async function saveExpense() {
    const errEl = el('sf-cx-err');
    errEl.textContent = '';
    const scope = el('sf-cx-scope').value;
    const amount = Number(el('sf-cx-amount').value);
    const pid = scope === 'per_pid' ? el('sf-cx-pid').value : null;
    if (!Number.isFinite(amount) || amount <= 0) { errEl.textContent = 'Amount must be greater than 0'; return; }
    if (scope === 'per_pid' && !pid) { errEl.textContent = 'Pick a PID'; return; }
    try {
      await api('/expenses', { method: 'POST', body: JSON.stringify({ scope, pid, amount, category: el('sf-cx-cat').value, note: el('sf-cx-note').value }) });
      setSaved();
      showToast('✓ Expense saved', 'success');
      renderCost();
    } catch (err) { errEl.textContent = err.message; }
  }

  async function voidExpense(id) {
    if (!confirm('Void this expense? It will no longer count in profit.')) return;
    try {
      await api(`/expenses/${id}/void`, { method: 'PATCH' });
      showToast('Expense voided', 'success');
      renderCost();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ═══════════════ VIEW: REVENUE ═══════════════
  async function renderRevenue() {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;
    if (!S._revState) S._revState = { preset: 'month', from: '', to: '' };
    const st = S._revState;

    try {
      const q = new URLSearchParams(rangeParams(st.preset, st));
      const data = await api('/reports/revenue?' + q.toString());
      const isOwner = role === 'admin' || !!userPerms?.sfViewProfit;

      const stat = (label, val, cls = '') => `
        <div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${val}</div></div>`;

      wrap.innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div><div class="sf-title">📈 ${t('revenue')}</div>
          <div class="sf-sub">${data.salesCount} sales · ${data.units} units</div></div>
          ${isOwner ? '<button class="btn btn-outline btn-sm" data-sf-export="revenue">⬇ CSV</button>' : ''}
        </div>
        ${rangeBarHtml(st)}
        <div class="stat-grid">
          ${stat('Revenue', money(data.revenue))}
          ${stat('Units', data.units)}
          ${isOwner ? stat('Cost', money(data.cost), 'danger') : ''}
          ${isOwner ? stat('Net Profit', money(data.profit), 'success') : ''}
        </div>
        ${isOwner && data.salesCount + (data.overhead || 0) + (data.perPidCost || 0) > 0 && data.cost !== undefined ? `
          <div class="card sf-card"><div class="card-title">Where cost comes from</div>
            <div class="flex-between" style="padding:0.3rem 0"><span>Product cost (COGS)</span><b>${money(data.cogs)}</b></div>
            <div class="flex-between" style="padding:0.3rem 0"><span>Overhead</span><b>${money(data.overhead)}</b></div>
            <div class="flex-between" style="padding:0.3rem 0"><span>Per-PID costs</span><b>${money(data.perPidCost)}</b></div>
            <hr class="divider"/>
            <div class="flex-between"><span class="font-bold">Profit = Revenue − Cost</span><b class="text-success">${money(data.profit)}</b></div>
          </div>` : ''}
        ${!isOwner ? `<div class="sf-hint" style="text-align:center">Cost & profit visible to Owner only</div>` : ''}
      </div>`;
      S._revenue = data;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ═══════════════ VIEW: TEAM ═══════════════
  async function renderTeam() {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;
    if (!S._teamState) S._teamState = { preset: 'month', from: '', to: '' };
    const st = S._teamState;

    try {
      const q = new URLSearchParams(rangeParams(st.preset, st));
      const rows = await api('/reports/team?' + q.toString());
      S._team = rows;
      const isSellerOnly = role !== 'admin' && !userPerms?.sfViewProfit && !userPerms?.sfManageShipments;

      wrap.innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div><div class="sf-title">👥 ${t('team')}</div>
          <div class="sf-sub">${isSellerOnly ? 'Your performance' : rows.length + ' sellers'}</div></div>
          <div class="sf-actions"><button class="btn btn-outline btn-sm" data-sf-export="team">⬇ CSV</button></div>
        </div>
        ${rangeBarHtml(st)}
        <div id="sf-team-body" style="min-height:200px"></div>
      </div>`;

      const colDefs = [
        { headerName: t('seller'), field: 'seller', flex: 1.4, minWidth: 130, cellRenderer: p => esc(p.value) },
        { headerName: 'Units', field: 'unitsSold', width: 100, type: 'rightAligned', sort: 'desc' },
        { headerName: 'Sales Value', field: 'totalSalesValue', width: 140, type: 'rightAligned', valueFormatter: p => money(p.value) },
        { headerName: 'Cash Collected', field: 'cashCollected', width: 150, type: 'rightAligned', valueFormatter: p => money(p.value) },
        { headerName: '# Sales', field: 'salesCount', width: 100, type: 'rightAligned' },
        { headerName: 'Last Sale', field: 'lastSaleAt', width: 130, valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—' },
      ];

      gridOrCards(
        el('sf-team-body'),
        { columnDefs: colDefs, rowData: rows },
        () => rows.map(r => `
          <div class="sf-card">
            <div class="sf-card-top"><div class="sf-card-pid">${esc(r.seller)}</div>
            <span class="sf-stock-chip ok">${r.unitsSold} units</span></div>
            <div class="sf-card-meta">Sold ${money(r.totalSalesValue)} · ${r.salesCount} sales</div>
          </div>`).join('') || `<div class="empty-state"><div class="empty-text">${t('noData')}</div></div>`
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ═══════════════ VIEW: DASHBOARD ═══════════════
  async function renderDashboard() {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;
    try {
      const d = await api('/reports/dashboard');
      S._dash = d;
      const isOwner = role === 'admin' || !!userPerms?.sfViewProfit;

      wrap.innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div><div class="sf-title">📊 ${t('dashboard')}</div>
          <div class="sf-sub">This month</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">Sales (month)</div><div class="stat-value">${d.salesThisMonth}</div></div>
          <div class="stat-card"><div class="stat-label">Revenue (month)</div><div class="stat-value">${money(d.revenueThisMonth)}</div></div>
          ${isOwner ? `<div class="stat-card"><div class="stat-label">Profit (month)</div><div class="stat-value success">${money(d.profitThisMonth)}</div></div>` : ''}
          <div class="stat-card"><div class="stat-label">Units in Stock</div><div class="stat-value">${d.unitsInStock}</div></div>
        </div>

        ${d.lowStock.length ? `
        <div class="alert-banner">⚠️ ${d.lowStock.length} PID(s) low on stock
          ${d.lowStock.slice(0, 5).map(l => `<br>• ${esc(l.pid)}: ${l.stock} left`).join('')}
          ${d.lowStock.length > 5 ? `<br>…and ${d.lowStock.length - 5} more` : ''}
        </div>` : ''}

        ${d.topProducts.length ? `
        <div class="card sf-card"><div class="card-title">🏆 Top Products</div>
          ${d.topProducts.map((p, i) => `
            <div class="flex-between" style="padding:0.35rem 0">
              <span style="font-size:0.85rem">${i + 1}. ${esc(p._id)}</span>
              <span><b>${p.units}</b> units · <span class="text-gold">${money(p.revenue)}</span></span>
            </div>`).join('')}
        </div>` : ''}

        <div class="card sf-card"><div class="card-title">${t('history')}</div>
          ${d.recentSales.length ? d.recentSales.map(s => `
            <div class="flex-between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <div><b style="font-size:0.82rem">${esc(s.serial)}</b> <span class="sf-hint">${esc(s.pid)}</span></div>
              <div style="text-align:right"><b>${money(s.price * s.qty)}</b><div class="sf-hint">${esc(s.seller)} · ${new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}${s.status !== 'active' ? ` · ${s.status.toUpperCase()}` : ''}</div></div>
            </div>`).join('') : `<div class="sf-hint">${t('noData')}</div>`}
        </div>
      </div>`;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ═══════════════ VIEW: MASTER (Owner/Manager) ═══════════════
  async function renderMaster(tab = S._masterTab || 'attrs') {
    const wrap = el('main-content');
    wrap.innerHTML = `<div class="sf-wrap"><div class="sf-loading"><div class="spinner"></div></div></div>`;
    S._masterTab = tab;

    try {
      if (tab === 'attrs') await loadMasters();
      else await Promise.all([loadMasters(), loadProducts()]);

      const tabsHtml = `
        <div class="period-tabs">
          <button class="period-tab ${tab === 'attrs' ? 'active' : ''}" data-sf-mtab="attrs">Lists (Type/Color/Design/Size)</button>
          <button class="period-tab ${tab === 'pids' ? 'active' : ''}" data-sf-mtab="pids">PID Products</button>
          <button class="period-tab ${tab === 'import' ? 'active' : ''}" data-sf-mtab="import">📥 Import</button>
        </div>`;

      const bodyHtml = tab === 'attrs' ? masterAttrsHtml() : tab === 'pids' ? masterPidsHtml() : masterImportHtml();

      wrap.innerHTML = `
      <div class="sf-wrap">
        <div class="sf-brandbar">
          <div><div class="sf-title">🧩 ${t('master')}</div>
          <div class="sf-sub">${tab === 'attrs' ? 'The four attribute lists — PIDs are built from these' : tab === 'pids' ? 'Every sellable variant' : 'Bring your existing sheet data in'}</div></div>
        </div>
        ${tabsHtml}
        <div class="sf-saved" id="sf-saved"></div>
        ${bodyHtml}
      </div>`;

      if (tab === 'attrs') wireMasterAttrs();
      else if (tab === 'pids') wireMasterPids();
      else wireMasterImport();
    } catch (err) {
      if (err.status === 403) {
        wrap.innerHTML = `<div class="sf-wrap"><div class="card" style="text-align:center;padding:2rem"><div style="font-size:2rem">🔒</div><div style="margin-top:0.5rem">Master data is Manager/Owner-only</div></div></div>`;
      } else showToast(err.message, 'error');
    }
  }

  // ── Tab 1: attribute lists ──
  function masterAttrsHtml() {
    const kinds = ['type', 'color', 'design', 'size'];
    return `
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap">
        ${kinds.map(k => `<select class="form-select" id="sf-ma-new-${k}" style="flex:1;min-width:120px" placeholder="New ${k}"><option value="">+ new ${k}</option></select>`).join('')}
        <input class="form-input" id="sf-ma-note" style="flex:1;min-width:140px" placeholder="Note (optional)" />
        <button class="btn btn-primary btn-sm" id="sf-ma-add">Add</button>
      </div>
      <div class="sf-hint" style="margin-bottom:0.5rem">Type the new value into the box of its kind (e.g. "NAVY" under color), then Add. Values used by products cannot be renamed or deleted — only deactivated.</div>
      ${kinds.map(k => `
        <div class="card sf-card">
          <div class="card-title">${k.toUpperCase()} <span style="font-weight:400;font-size:0.7rem;color:var(--text-muted)">(${S.masters[k].filter(v => true).length || 0})</span></div>
          <div id="sf-ma-list-${k}">
            ${(S._allMasters || []).filter(m => m.kind === k).map(m => `
              <div class="flex-between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
                <div>
                  <b style="font-size:0.85rem;${m.isActive ? '' : 'color:var(--text-muted);text-decoration:line-through'}">${esc(m.value)}</b>
                  ${m.note ? `<span class="sf-hint"> · ${esc(m.note)}</span>` : ''}
                  ${!m.isActive ? '<span class="sf-stock-chip low" style="margin-left:0.3rem">inactive</span>' : ''}
                </div>
                <div style="display:flex;gap:0.3rem">
                  ${m.isActive
                    ? `<button class="btn btn-outline btn-sm" data-sf-ma-edit="${m._id}">Rename</button>
                       <button class="btn btn-danger btn-sm" data-sf-ma-deact="${m._id}">Deactivate</button>`
                    : `<button class="btn btn-outline btn-sm" data-sf-ma-react="${m._id}">Reactivate</button>`}
                </div>
              </div>`).join('') || `<div class="sf-hint">${t('noData')}</div>`}
          </div>
        </div>`).join('')}`;
  }

  function wireMasterAttrs() {
    // populate the 4 "new value" inputs as free-text datalist combos
    ['type', 'color', 'design', 'size'].forEach(k => {
      const sel = el(`sf-ma-new-${k}`);
      if (!sel) return;
      // allow free text: replace select with input+datalist behavior
      const wrapIn = document.createElement('div');
      wrapIn.innerHTML = `<input class="form-input" list="sf-ma-dl-${k}" id="sf-ma-new-${k}" placeholder="new ${k}" style="width:100%" />
        <datalist id="sf-ma-dl-${k}">${S.masters[k].map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
      sel.replaceWith(wrapIn.firstChild);
    });

    el('sf-ma-add').onclick = async () => {
      const kinds = ['type', 'color', 'design', 'size'];
      const entries = kinds.map(k => ({ k, v: el(`sf-ma-new-${k}`).value.trim() })).filter(x => x.v);
      if (!entries.length) return showToast('Type a value in a box first', 'error');
      let okCount = 0;
      for (const { k, v } of entries) {
        try {
          const r = await api('/master', { method: 'POST', body: JSON.stringify({ kind: k, value: v, note: el('sf-ma-note')?.value || '' }) });
          if (r.reactivated) showToast(`${v} reactivated`, 'success'); else okCount++;
        } catch (err) { showToast(`${k}/${v}: ${err.message}`, 'error'); }
      }
      if (okCount) { setSaved(`✓ ${okCount} added`); showToast(`✓ ${okCount} value(s) added`, 'success'); }
      renderMaster('attrs');
    };

    document.querySelectorAll('[data-sf-ma-edit]').forEach(b => b.onclick = async () => {
      const id = b.dataset.sfMaEdit;
      const cur = (S._allMasters || []).find(m => m._id === id);
      const v = prompt('Rename value (only allowed while no product uses it):', cur?.value || '');
      if (!v || v === cur?.value) return;
      try { await api(`/master/${id}`, { method: 'PUT', body: JSON.stringify({ value: v }) }); setSaved(); renderMaster('attrs'); }
      catch (err) { showToast(err.message, 'error'); }
    });

    document.querySelectorAll('[data-sf-ma-deact]').forEach(b => b.onclick = async () => {
      if (!confirm('Deactivate this value? It stays in history but disappears from the pickers.')) return;
      try { await api(`/master/${b.dataset.sfMaDeact}/deactivate`, { method: 'PUT' }); setSaved(); renderMaster('attrs'); }
      catch (err) { showToast(err.message, 'error'); }
    });

    document.querySelectorAll('[data-sf-ma-react]').forEach(b => b.onclick = async () => {
      try { await api(`/master/${b.dataset.sfMaReact}`, { method: 'PUT', body: JSON.stringify({ isActive: true }) }); setSaved(); renderMaster('attrs'); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  // ── Tab 2: PID products ──
  function masterPidsHtml() {
    const rows = S.products;
    return `
      <div class="card sf-card">
        <div class="card-title">➕ New Product (auto-builds PID)</div>
        <div class="sf-cascade">
          <div><label class="form-label">${t('type')}</label><select class="form-select" id="sf-mp-type"><option value="">—</option>${S.masters.type.map(v => `<option>${esc(v)}</option>`).join('')}</select></div>
          <div><label class="form-label">${t('color')}</label><select class="form-select" id="sf-mp-color"><option value="">—</option>${S.masters.color.map(v => `<option>${esc(v)}</option>`).join('')}</select></div>
          <div><label class="form-label">${t('design')}</label><select class="form-select" id="sf-mp-design"><option value="">—</option>${S.masters.design.map(v => `<option>${esc(v)}</option>`).join('')}</select></div>
          <div><label class="form-label">${t('size')}</label><select class="form-select" id="sf-mp-size"><option value="">—</option>${S.masters.size.map(v => `<option>${esc(v)}</option>`).join('')}</select></div>
        </div>
        <div class="sf-cascade" style="margin-top:0.5rem">
          <div><label class="form-label">${t('unitCost')} ৳</label><input class="form-input" type="number" id="sf-mp-cost" min="0" placeholder="0" /></div>
          <div><label class="form-label">${t('price')} ৳</label><input class="form-input" type="number" id="sf-mp-price" min="0" placeholder="0" /></div>
          <div><label class="form-label">Alert ≤</label><input class="form-input" type="number" id="sf-mp-low" min="0" placeholder="5" /></div>
        </div>
        <div class="sf-hint" id="sf-mp-preview" style="margin-top:0.4rem"></div>
        <div class="sf-field-err" id="sf-mp-err"></div>
        <button class="btn btn-primary btn-block" id="sf-mp-add" style="margin-top:0.5rem">✓ Add Product</button>
      </div>
      <div id="sf-mp-list" style="min-height:220px"></div>`;
  }

  function wireMasterPids() {
    const ids = ['type', 'color', 'design', 'size'].map(k => `sf-mp-${k}`);
    const preview = () => {
      const parts = ids.map(id => el(id).value);
      el('sf-mp-preview').textContent = parts.every(Boolean) ? `PID: ${parts.join('-')}` : 'Pick all four to build the PID';
    };
    ids.forEach(id => el(id).addEventListener('change', preview));
    preview();

    el('sf-mp-add').onclick = async () => {
      const errEl = el('sf-mp-err'); errEl.textContent = '';
      const [type, color, design, size] = ids.map(id => el(id).value);
      if (!type || !color || !design || !size) { errEl.textContent = 'Pick all four attributes'; return; }
      try {
        await api('/products', {
          method: 'POST',
          body: JSON.stringify({
            type, color, design, size,
            unitCost: Number(el('sf-mp-cost').value) || 0,
            sellingPrice: Number(el('sf-mp-price').value) || 0,
            lowStockThreshold: Number(el('sf-mp-low').value) || 5,
          }),
        });
        setSaved(); showToast(`✓ ${type}-${color}-${design}-${size} added`, 'success');
        renderMaster('pids');
      } catch (err) { errEl.textContent = err.message; }
    };

    const stockMap = Object.fromEntries(S.products.map(p => [p.pid, p.stock]));
    const colDefs = [
      { headerName: t('pid'), field: 'pid', cellClass: 'sf-cell-pid', flex: 2, minWidth: 240, cellRenderer: p => esc(p.value) + (p.data.isActive ? '' : ' 🚫') },
      { headerName: `${t('unitCost')} ৳`, field: 'unitCost', width: 120, editable: true, type: 'rightAligned', valueParser: p => Math.max(0, Number(p.newValue) || 0) },
      { headerName: `${t('price')} ৳`, field: 'sellingPrice', width: 120, editable: true, type: 'rightAligned', valueParser: p => Math.max(0, Number(p.newValue) || 0) },
      { headerName: 'Alert ≤', field: 'lowStockThreshold', width: 100, editable: true, type: 'rightAligned', valueParser: p => Math.max(0, parseInt(p.newValue, 10) || 0) },
      { headerName: t('stockCol'), width: 100, type: 'rightAligned', valueGetter: p => stockMap[p.data.pid] ?? 0, cellClass: p => ((stockMap[p.data.pid] ?? 0) <= (p.data.lowStockThreshold ?? 5) ? 'sf-cell-low' : 'sf-cell-ok') },
      {
        headerName: '', width: 110, sortable: false, filter: false,
        cellRenderer: p => p.data.isActive
          ? `<button class="btn btn-danger btn-sm sf-void-btn" data-sf-mp-deact="${p.data.pid}">Deactivate</button>`
          : `<button class="btn btn-outline btn-sm sf-void-btn" data-sf-mp-react="${p.data.pid}">Activate</button>`,
      },
    ];

    gridOrCards(
      el('sf-mp-list'),
      {
        columnDefs: colDefs,
        rowData: [...S.products],
        stopEditingWhenCellsLoseFocus: true,
        onCellValueChanged: async (e) => {
          try {
            await api(`/products/${e.data.pid}`, { method: 'PUT', body: JSON.stringify({ [e.colDef.field]: e.data[e.colDef.field] }) });
            setSaved();
          } catch (err) { showToast(err.message, 'error'); renderMaster('pids'); }
        },
      },
      () => S.products.map(p => `
        <div class="sf-card">
          <div class="sf-card-top">
            <div class="sf-card-pid">${esc(p.pid)}${p.isActive ? '' : ' 🚫'}</div>
            <span class="sf-stock-chip ${(stockMap[p.pid] ?? 0) <= (p.lowStockThreshold ?? 5) ? 'low' : 'ok'}">${stockMap[p.pid] ?? 0}</span>
          </div>
          <div class="sf-card-meta">Cost ${money(p.unitCost)} · Sell ${money(p.sellingPrice)}${p.isActive ? ` · <button class="btn btn-danger btn-sm sf-void-btn" data-sf-mp-deact="${p.pid}">Deactivate</button>` : ` · <button class="btn btn-outline btn-sm sf-void-btn" data-sf-mp-react="${p.pid}">Activate</button>`}</div>
        </div>`).join('') || `<div class="empty-state"><div class="empty-text">${t('noData')}</div></div>`
    );

    document.querySelectorAll('[data-sf-mp-deact]').forEach(b => b.onclick = async () => {
      if (!confirm(`Deactivate ${b.dataset.sfMpDeact}? History is kept; it just disappears from pickers.`)) return;
      try { await api(`/products/${b.dataset.sfMpDeact}`, { method: 'DELETE' }); setSaved(); renderMaster('pids'); }
      catch (err) { showToast(err.message, 'error'); }
    });
    document.querySelectorAll('[data-sf-mp-react]').forEach(b => b.onclick = async () => {
      try { await api(`/products/${b.dataset.sfMpReact}`, { method: 'PUT', body: JSON.stringify({ isActive: true }) }); setSaved(); renderMaster('pids'); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  // ── Tab 3: CSV import with preview & validation ──
  function masterImportHtml() {
    return `
      <div class="card sf-card">
        <div class="card-title">📥 Import from your sheet (CSV)</div>
        <div class="sf-hint" style="margin-bottom:0.6rem">
          Export your Google Sheet tabs as CSV. Three kinds are supported:
          <b>Products</b> — columns <code>type,color,design,size,unitCost,sellingPrice,lowStockThreshold</code> ·
          <b>Shipments</b> — <code>pid,qty,note</code> ·
          <b>Master values</b> — <code>kind,value</code>.
          Existing PIDs/kinds/values are skipped (no duplicates). Nothing is committed until you press Import below.
        </div>
        <input type="file" id="sf-imp-file" accept=".csv,text/csv" class="form-input" style="padding:0.5rem" />
        <div class="sf-hint" style="margin:0.5rem 0 0.3rem">…or paste CSV rows (first row = headers):</div>
        <textarea class="form-input" id="sf-imp-text" rows="6" style="font-family:monospace;font-size:0.75rem" placeholder="type,color,design,size,unitCost,sellingPrice\nTSHIRT,NAVY,ABC,M,250,450\nPOLO,WHITE,DZ,L,400,750"></textarea>
        <button class="btn btn-outline btn-sm" style="margin-top:0.5rem" id="sf-imp-analyze">🔍 Analyze</button>
      </div>
      <div id="sf-imp-preview"></div>`;
  }

  function parseCsv(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const split = (line) => {
      const out = []; let cur = ''; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(s => s.trim());
    };
    const headers = split(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    const rows = lines.slice(1).map(l => { const cells = split(l); return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])); });
    return { headers, rows };
  }

  function detectImportKind(rows) {
    if (!rows.length) return null;
    const has = (k) => rows.every(r => k in r) && rows.some(r => r[k] !== '');
    if (has('pid') && has('qty')) return 'shipments';
    if (has('kind') && has('value')) return 'master';
    if (has('type') && has('color') && has('design') && has('size')) return 'products';
    return null;
  }

  async function analyzeImport() {
    const prev = el('sf-imp-preview');
    const file = el('sf-imp-file')?.files?.[0];
    let text = el('sf-imp-text').value;
    if (file) text = await file.text();
    if (!text.trim()) { prev.innerHTML = '<div class="sf-field-err">Paste CSV rows or choose a file first</div>'; return; }

    const { headers, rows } = parseCsv(text);
    const kind = detectImportKind(rows);
    if (!kind) {
      prev.innerHTML = `<div class="sf-field-err">Could not detect the table kind. Expected headers like type,color,design,size… or pid,qty… or kind,value. Got: ${esc(headers.join(', ') || '(none)')}</div>`;
      return;
    }

    await loadMasters();
    await loadProducts().catch(() => { });
    const existingPids = new Set(S.products.map(p => p.pid));
    const existingVals = new Set((S._allMasters || []).map(m => `${m.kind}:${m.value}`));
    const errors = [], valid = [], skipped = [];

    rows.forEach((r, i) => {
      const line = i + 2; // +1 header, +1 human numbering
      if (kind === 'master') {
        const k = (r.kind || '').toLowerCase().trim();
        const v = (r.value || '').toUpperCase().trim();
        if (!['type', 'color', 'design', 'size'].includes(k)) { errors.push(`Row ${line}: kind "${r.kind}" must be type/color/design/size`); return; }
        if (!v) { errors.push(`Row ${line}: value empty`); return; }
        if (existingVals.has(`${k}:${v}`)) { skipped.push(`Row ${line}: ${k} ${v} already exists`); return; }
        valid.push({ body: { kind: k, value: v } });
      } else if (kind === 'products') {
        const parts = { type: (r.type || '').toUpperCase().trim(), color: (r.color || '').toUpperCase().trim(), design: (r.design || '').toUpperCase().trim(), size: (r.size || '').toUpperCase().trim() };
        const pid = [parts.type, parts.color, parts.design, parts.size].join('-');
        if (Object.values(parts).some(x => !x)) { errors.push(`Row ${line}: missing one of type/color/design/size`); return; }
        for (const [k, v] of Object.entries(parts)) {
          if (!S.masters[k].includes(v)) { errors.push(`Row ${line}: ${k} "${v}" not in master list (import master values first)`); }
        }
        if (existingPids.has(pid)) { skipped.push(`Row ${line}: ${pid} already exists`); return; }
        if (errors.some(e => e.startsWith(`Row ${line}:`))) return;
        valid.push({ body: { ...parts, unitCost: Number(r.unitcost) || 0, sellingPrice: Number(r.sellingprice) || 0, lowStockThreshold: Number(r.lowstockthreshold) || 5 } });
      } else if (kind === 'shipments') {
        const pid = (r.pid || '').toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').trim();
        const qty = parseInt(r.qty, 10);
        if (!S.products.some(p => p.pid === pid)) { errors.push(`Row ${line}: unknown PID ${pid || '(empty)'} (import products first)`); return; }
        if (!Number.isInteger(qty) || qty < 1) { errors.push(`Row ${line}: qty must be a whole number ≥ 1`); return; }
        valid.push({ body: { pid, qty, note: r.note || '' } });
      }
    });

    S._importPlan = { kind, valid, errors, skipped };
    prev.innerHTML = `
      <div class="card sf-card">
        <div class="card-title">Preview — ${kind} (${rows.length} rows)</div>
        ${errors.length ? `<div class="sf-zero-note" style="margin-bottom:0.4rem">❌ ${errors.length} error(s):<br>${errors.slice(0, 8).map(esc).join('<br>')}${errors.length > 8 ? '<br>…' : ''}</div>` : ''}
        ${skipped.length ? `<div class="sf-hint">⏭ ${skipped.length} will be skipped (already exist):<br>${skipped.slice(0, 5).map(esc).join('<br>')}${skipped.length > 5 ? '<br>…' : ''}</div>` : ''}
        <div class="sf-hint" style="margin-top:0.3rem">✅ ${valid.length} row(s) ready to import${errors.length ? ` — the ${errors.length} error row(s) will be left out; fix them later in the tabs above` : ''}</div>
        ${valid.length ? `<button class="btn btn-primary btn-block" id="sf-imp-commit" style="margin-top:0.6rem">✓ Import ${valid.length} ${kind}${errors.length ? ' (valid rows only)' : ''}</button>` : ''}
      </div>`;

    const btn = el('sf-imp-commit');
    if (btn) btn.onclick = commitImport;
  }

  async function commitImport() {
    const plan = S._importPlan;
    if (!plan || !plan.valid.length) return;
    const endpoints = { master: ['/master', 'POST'], products: ['/products', 'POST'], shipments: ['/shipments', 'POST'] };
    const [path, method] = endpoints[plan.kind];
    let ok = 0;
    for (const item of plan.valid) {
      try { await api(path, { method, body: JSON.stringify(item.body) }); ok++; }
      catch (err) { showToast(`${err.message}`, 'error'); }
    }
    setSaved(`✓ ${ok} imported`);
    showToast(`✓ ${ok}/${plan.valid.length} ${plan.kind} imported`, 'success');
    S._importPlan = null;
    renderMaster('import');
  }

  function wireMasterImport() {
    el('sf-imp-analyze').onclick = analyzeImport;
    el('sf-imp-file').addEventListener('change', () => { if (el('sf-imp-file').files[0]) analyzeImport(); });
  }

  // ═══════════════ ROUTER ═══════════════
  const VIEWS = {
    hub: renderHub,
    stock: () => renderStock(false),
    shipment: renderShipment,
    sell: renderSell,
    cost: renderCost,
    revenue: renderRevenue,
    team: renderTeam,
    dashboard: renderDashboard,
    master: () => renderMaster(),
  };
  const COMING_SOON = {};
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
    const voidExp = e.target.closest('[data-sf-void-exp]');
    if (voidExp) { voidExpense(voidExp.dataset.sfVoidExp); return; }
    const mtab = e.target.closest('[data-sf-mtab]');
    if (mtab) { renderMaster(mtab.dataset.sfMtab); return; }
    const rangeTab = e.target.closest('[data-sf-range]');
    if (rangeTab) {
      const st = currentSfView === 'cost' ? S._costState : currentSfView === 'revenue' ? S._revState : S._teamState;
      st.preset = rangeTab.dataset.sfRange;
      SF.refresh();
      return;
    }
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
