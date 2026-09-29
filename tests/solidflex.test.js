const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// Tests log in many times from one IP — relax the limiter BEFORE the app loads
process.env.SF_LOGIN_MAX_ATTEMPTS = '10000';

const { startDb, stopDb, cleanDb } = require('./solidflex.setup');
const app = require('../server');
const { normalizePid, parsePid, buildPid } = require('../services/solidflex/pidService');
const stockService = require('../services/solidflex/stockService');
const { SF_ROLE_PRESETS, SF_PERMS } = require('../services/solidflex/rolePresets');
const SfProduct = require('../models/solidflex/SfProduct');
const SfMaster = require('../models/solidflex/SfMaster');
const SfSale = require('../models/solidflex/SfSale');
const SfShipment = require('../models/solidflex/SfShipment');
const SfAuditLog = require('../models/solidflex/SfAuditLog');
const { nextSaleSerial } = require('../services/solidflex/serialService');

const PORT = process.env.PORT || 0;
let server, base;

async function login(pin) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const body = await res.json();
  return { token: body.token, role: body.role, name: body.name, permissions: body.permissions };
}

async function api(token, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

before(async () => {
  await startDb();
  await new Promise(r => { server = app.listen(PORT, () => r()); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) server.close();
  await stopDb();
});

// ────────────────────────── PID logic ──────────────────────────
describe('PID service', () => {
  test('normalizes case, spaces, underscores into canonical PID', () => {
    assert.equal(normalizePid('tshirt_ black- ABC -m'), 'TSHIRT-BLACK-ABC-M');
    assert.equal(normalizePid('TSHIRT--BLACK---ABC-M'), 'TSHIRT-BLACK-ABC-M');
  });

  test('rejects PIDs without exactly 4 segments', () => {
    assert.equal(normalizePid('TSHIRT-BLACK-M'), null);
    assert.equal(normalizePid('TSHIRT-BLACK-ABC-M-EXTRA'), null);
    assert.equal(normalizePid(''), null);
    assert.equal(normalizePid(null), null);
  });

  test('parsePid splits into four parts', () => {
    const p = parsePid('TSHIRT-BLACK-ABC-M');
    assert.deepEqual([p.type, p.color, p.design, p.size], ['TSHIRT', 'BLACK', 'ABC', 'M']);
  });

  test('buildPid joins and uppercases', () => {
    assert.equal(buildPid({ type: 'polo', color: 'navy', design: 'dz', size: 'xl' }), 'POLO-NAVY-DZ-XL');
  });
});

// ────────────────────────── stock calc ──────────────────────────
describe('stock service (derived)', () => {
  test('stock = shipments − active sales, returns/voids excluded', async () => {
    await cleanDb();
    await SfShipment.create({ pid: 'TSHIRT-BLACK-ABC-M', qty: 10, date: new Date() });
    await SfShipment.create({ pid: 'TSHIRT-BLACK-ABC-M', qty: 5, date: new Date() });
    await SfSale.create({ serial: 'SF-TEST-0001', pid: 'TSHIRT-BLACK-ABC-M', qty: 3, price: 100, unitCost: 50, seller: 'A', date: new Date() });
    await SfSale.create({ serial: 'SF-TEST-0002', pid: 'TSHIRT-BLACK-ABC-M', qty: 2, price: 100, unitCost: 50, seller: 'A', date: new Date(), status: 'returned' });

    const stock = await stockService.getStock('TSHIRT-BLACK-ABC-M');
    assert.equal(stock, 12); // 15 in − 3 active out; the 2 returned don't count
  });
});

// ────────────────────────── API flow ──────────────────────────
describe('SOLID FLEX API', () => {
  let owner, tokens = {};

  before(async () => {
    await cleanDb();
    owner = await login(process.env.ADMIN_PIN || '1234');
    assert.ok(owner.token, 'admin login must work (set ADMIN_PIN in test env)');
  });

  test('admin seeds masters and products', async () => {
    for (const [kind, values] of [
      ['type', ['TSHIRT', 'POLO', 'DROPSHOULDER']],
      ['color', ['BLACK', 'WHITE']],
      ['design', ['ABC', 'DZ']],
      ['size', ['M', 'L']],
    ]) {
      for (const v of values) {
        const r = await api(owner.token, 'POST', '/api/solidflex/master', { kind, value: v });
        assert.equal(r.status, 201, `seed ${kind} ${v}: ${JSON.stringify(r.body)}`);
      }
    }
    const r = await api(owner.token, 'POST', '/api/solidflex/products', {
      type: 'TSHIRT', color: 'BLACK', design: 'ABC', size: 'M',
      unitCost: 250, sellingPrice: 450, lowStockThreshold: 5,
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.pid, 'TSHIRT-BLACK-ABC-M');
  });

  test('duplicate PID rejected with 409', async () => {
    const r = await api(owner.token, 'POST', '/api/solidflex/products', {
      type: 'TSHIRT', color: 'BLACK', design: 'ABC', size: 'M',
    });
    assert.equal(r.status, 409);
  });

  test('product with non-master attribute rejected', async () => {
    const r = await api(owner.token, 'POST', '/api/solidflex/products', {
      type: 'TSHIRT', color: 'PINK', design: 'ABC', size: 'M',
    });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /color master list/);
  });

  test('sale over stock is rejected; stock stays consistent', async () => {
    await api(owner.token, 'POST', '/api/solidflex/shipments', { pid: 'TSHIRT-BLACK-ABC-M', qty: 3 });
    const r = await api(owner.token, 'POST', '/api/solidflex/sales', { pid: 'TSHIRT-BLACK-ABC-M', qty: 2 });
    assert.equal(r.status, 201);
    assert.equal(r.body.stockAfter, 1);

    const oversell = await api(owner.token, 'POST', '/api/solidflex/sales', { pid: 'TSHIRT-BLACK-ABC-M', qty: 2 });
    assert.equal(oversell.status, 409);
    assert.match(oversell.body.message, /Only 1 left/);

    const stock = await api(owner.token, 'GET', '/api/solidflex/reports/stock');
    const row = stock.body.rows.find(x => x.pid === 'TSHIRT-BLACK-ABC-M');
    assert.equal(row.stock, 1);
  });

  test('returning a sale restores stock', async () => {
    const sales = await api(owner.token, 'GET', '/api/solidflex/sales?pid=TSHIRT-BLACK-ABC-M');
    const serial = sales.body[0].serial;
    const r = await api(owner.token, 'PATCH', `/api/solidflex/sales/${serial}/status`, { status: 'returned' });
    assert.equal(r.status, 200);
    const stock = await api(owner.token, 'GET', '/api/solidflex/reports/stock');
    assert.equal(stock.body.rows.find(x => x.pid === 'TSHIRT-BLACK-ABC-M').stock, 3);
  });

  test('audit log captured the mutations', async () => {
    const logs = await api(owner.token, 'GET', '/api/solidflex/audit?limit=50');
    assert.equal(logs.status, 200);
    const actions = logs.body.map(l => l.action);
    for (const a of ['sf_master.create', 'sf_product.create', 'sf_shipment.create', 'sf_sale.create', 'sf_sale.returned']) {
      assert.ok(actions.includes(a), `expected ${a} in audit log`);
    }
  });
});

// ────────────────────────── permissions ──────────────────────────
describe('role permissions (server-side gating)', () => {
  let owner;

  before(async () => {
    await cleanDb();
    owner = await login(process.env.ADMIN_PIN || '1234');
  });

  async function makeUser(name, pin, permissions) {
    const r = await api(owner.token, 'POST', '/api/users', { name, pin, permissions });
    assert.equal(r.status, 201, `create user ${name}: ${JSON.stringify(r.body)}`);
    return login(pin);
  }

  test('seller can sell but cannot see profit, masters, or expenses', async () => {
    const seller = await makeUser('Rana', '7777', SF_ROLE_PRESETS.seller);

    // seed minimal data as owner
    await api(owner.token, 'POST', '/api/solidflex/master', { kind: 'type', value: 'TSHIRT' });
    for (const [kind, value] of [['color', 'WHITE'], ['design', 'DZ'], ['size', 'L']]) {
      await api(owner.token, 'POST', '/api/solidflex/master', { kind, value });
    }
    await api(owner.token, 'POST', '/api/solidflex/products', { type: 'TSHIRT', color: 'WHITE', design: 'DZ', size: 'L', unitCost: 200, sellingPrice: 400 });
    await api(owner.token, 'POST', '/api/solidflex/shipments', { pid: 'TSHIRT-WHITE-DZ-L', qty: 5 });

    // allowed: sell + stock + own sales
    const sell = await api(seller.token, 'POST', '/api/solidflex/sales', { pid: 'TSHIRT-WHITE-DZ-L', qty: 1 });
    assert.equal(sell.status, 201);
    const stock = await api(seller.token, 'GET', '/api/solidflex/reports/stock');
    assert.equal(stock.status, 200);

    // denied: profit, masters mgmt, expenses, shipments, void, other sellers' sales
    const profit = await api(seller.token, 'GET', '/api/solidflex/reports/revenue');
    assert.equal(profit.status, 200);
    assert.equal(profit.body.profit, undefined, 'profit field must be stripped server-side');
    assert.equal(profit.body.cost, undefined, 'cost field must be stripped server-side');

    assert.equal((await api(seller.token, 'POST', '/api/solidflex/master', { kind: 'color', value: 'RED' })).status, 403);
    // but sellers CAN read master lists (needed for PID autofill on the sell screen)
    assert.equal((await api(seller.token, 'GET', '/api/solidflex/master')).status, 200);
    assert.equal((await api(seller.token, 'GET', '/api/solidflex/expenses')).status, 403);
    assert.equal((await api(seller.token, 'GET', '/api/solidflex/shipments')).status, 403);
    assert.equal((await api(seller.token, 'PATCH', `/api/solidflex/sales/${sell.body.serial}/status`, { status: 'voided' })).status, 403);

    const ownSales = await api(seller.token, 'GET', '/api/solidflex/sales');
    assert.ok(ownSales.body.every(s => s.seller === 'Rana'), 'seller sees only own sales');
  });

  test('manager sees revenue but not profit; cannot access audit log', async () => {
    const manager = await makeUser('MGR', '8888', SF_ROLE_PRESETS.manager);
    const rev = await api(manager.token, 'GET', '/api/solidflex/reports/revenue');
    assert.equal(rev.status, 200);
    assert.equal(rev.body.profit, undefined);

    assert.equal((await api(manager.token, 'GET', '/api/solidflex/audit')).status, 403);
    // managers CAN manage shipments & masters
    assert.equal((await api(manager.token, 'GET', '/api/solidflex/shipments')).status, 200);
  });

  test('owner sees full profit picture', async () => {
    const rev = await api(owner.token, 'GET', '/api/solidflex/reports/revenue');
    assert.equal(rev.status, 200);
    assert.equal(typeof rev.body.profit, 'number');
    assert.equal(typeof rev.body.cost, 'number');
  });

  test('role presets exist for owner/manager/seller', () => {
    assert.ok(SF_ROLE_PRESETS.owner.sfViewProfit);
    assert.ok(!SF_ROLE_PRESETS.manager.sfViewProfit);
    assert.ok(SF_ROLE_PRESETS.seller.sfSell);
    assert.equal(Object.keys(SF_PERMS).length >= 5, true);
  });
});

// ────────────────────────── concurrency: the oversell test ──────────────────────────
describe('concurrency safety', () => {
  test('two concurrent sales of the last unit → exactly one succeeds', async () => {
    await cleanDb();
    const owner = await login(process.env.ADMIN_PIN || '1234');

    await api(owner.token, 'POST', '/api/solidflex/master', { kind: 'type', value: 'TSHIRT' });
    for (const [kind, value] of [['color', 'BLACK'], ['design', 'DZ'], ['size', 'L']]) {
      await api(owner.token, 'POST', '/api/solidflex/master', { kind, value });
    }
    await api(owner.token, 'POST', '/api/solidflex/products', { type: 'TSHIRT', color: 'BLACK', design: 'DZ', size: 'L', sellingPrice: 500 });
    await api(owner.token, 'POST', '/api/solidflex/shipments', { pid: 'TSHIRT-BLACK-DZ-L', qty: 1 });

    const [r1, r2] = await Promise.all([
      api(owner.token, 'POST', '/api/solidflex/sales', { pid: 'TSHIRT-BLACK-DZ-L', qty: 1 }),
      api(owner.token, 'POST', '/api/solidflex/sales', { pid: 'TSHIRT-BLACK-DZ-L', qty: 1 }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    assert.deepEqual(statuses, [201, 409], `expected exactly one success + one 409, got ${r1.status}/${r2.status}`);
    const stock = await api(owner.token, 'GET', '/api/solidflex/reports/stock');
    assert.equal(stock.body.rows.find(x => x.pid === 'TSHIRT-BLACK-DZ-L').stock, 0);
  });

  test('serials are unique across concurrent sales', async () => {
    await cleanDb();
    const owner = await login(process.env.ADMIN_PIN || '1234');
    for (const [kind, value] of [['type', 'POLO'], ['color', 'WHITE'], ['design', 'DZ'], ['size', 'M']]) {
      await api(owner.token, 'POST', '/api/solidflex/master', { kind, value });
    }
    await api(owner.token, 'POST', '/api/solidflex/products', { type: 'POLO', color: 'WHITE', design: 'DZ', size: 'M' });
    await api(owner.token, 'POST', '/api/solidflex/shipments', { pid: 'POLO-WHITE-DZ-M', qty: 10 });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => api(owner.token, 'POST', '/api/solidflex/sales', { pid: 'POLO-WHITE-DZ-M', qty: 1 }))
    );
    const serials = results.filter(r => r.status === 201).map(r => r.body.serial);
    assert.equal(new Set(serials).size, serials.length, 'serials must be unique');
    assert.ok(serials.every(s => /^SF-\d{4}-\d{4}$/.test(s)), `serial format wrong: ${serials.join(',')}`);
  });
});
