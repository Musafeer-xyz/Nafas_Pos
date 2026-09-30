const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// /healthz must work with no DB connected — server.js only connects when run directly
const app = require('../server');

describe('GET /healthz', () => {
  let server, base;

  before(async () => {
    await new Promise(r => { server = app.listen(0, () => r()); });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => { if (server) server.close(); });

  test('returns ok:true without auth, without DB', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(typeof body.uptime === 'number' && body.uptime >= 0);
  });
});
