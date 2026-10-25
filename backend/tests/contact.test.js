

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

describe('Contact & Health API Test Suite', () => {
  before((t, done) => {
    
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((t, done) => {
    server.close(done);
  });

  test('GET /api/health returns valid status and reveals no secrets', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();

    assert.ok(data.status === 'healthy' || data.status === 'degraded', 'Status should be healthy or degraded');
    assert.strictEqual(data.service, 'puvima-consultancy-api');
    assert.strictEqual(typeof data.timestamp, 'string');
    assert.strictEqual(typeof data.uptimeSeconds, 'number');

    
    const jsonString = JSON.stringify(data);
    assert.strictEqual(jsonString.includes('password'), false, 'Should never reveal password');
    assert.strictEqual(jsonString.includes('root'), false, 'Should never reveal DB user');
    assert.strictEqual(jsonString.includes('secret'), false, 'Should never reveal secrets');
  });

  test('POST /api/contact rejects empty payload with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(Array.isArray(data.errors));
    assert.ok(data.errors.length >= 3, 'Should report missing name, email, and message');
  });

  test('POST /api/contact rejects invalid email format', async () => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Mercer',
        email: 'invalid-email-address',
        message: 'Inquiry regarding autonomous navigation systems.'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    const hasEmailErr = data.errors.some(e => e.includes('valid corporate work email'));
    assert.ok(hasEmailErr, 'Should flag invalid email');
  });

  test('POST /api/contact rejects message shorter than 5 characters', async () => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Mercer',
        email: 'alex@example.com',
        message: 'Hi'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    const hasMsgErr = data.errors.some(e => e.includes('Message is required and must be between 5 and 4000 characters'));
    assert.ok(hasMsgErr, 'Should flag too-short message');
  });

  test('POST /api/contact safely handles database unavailability without crashing', async () => {
    
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Elena Rostova',
        email: 'elena@example.com',
        company: 'Robotics Dynamics',
        subject: 'Autonomous Mobile Robots Project',
        message: 'We are seeking engineering advisory for autonomous mobile robot fleet coordination.'
      })
    });

    assert.ok(res.status === 201 || res.status === 503, `Status was ${res.status}`);
    const data = await res.json();
    if (res.status === 201) {
      assert.strictEqual(data.success, true);
      assert.ok(data.referenceId.startsWith('PV-CNT-'));
      const storeService = require('../src/services/store.service');
      await storeService.deleteContact(data.referenceId);
    } else {
      assert.strictEqual(data.success, false);
      assert.ok(!data.message.includes('ECONNREFUSED'), 'Must not leak low-level socket errors to client');
    }
  });
});
