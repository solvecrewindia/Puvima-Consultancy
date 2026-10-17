

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

describe('Consultation Booking API Test Suite', () => {
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

  test('POST /api/bookings rejects missing required fields with 400', async () => {
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(Array.isArray(data.errors));
    assert.ok(data.errors.length >= 4, 'Should flag name, email, topic, date, and time');
  });

  test('POST /api/bookings rejects past consultation dates', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Julian Vance',
        email: 'julian@enterprise.com',
        topic: 'FinTech & Stock Market Analytics',
        preferredDate: yesterday,
        preferredTime: '10:00 AM - 11:00 AM EST'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    const hasPastDateErr = data.errors.some(e => e.includes('cannot be in the past'));
    assert.ok(hasPastDateErr, 'Should reject date in the past');
  });

  test('POST /api/bookings rejects malformed date strings', async () => {
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Julian Vance',
        email: 'julian@enterprise.com',
        topic: 'AI/ML & Research Solutions',
        preferredDate: 'not-a-real-date',
        preferredTime: '10:00 AM - 11:00 AM EST'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('POST /api/bookings returns 201 or safe 503 and strictly preserves pending_review status', async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sophia Chen',
        email: 'sophia@techinnovations.io',
        company: 'Tech Innovations Corp',
        topic: 'Robotics & Autonomous Systems',
        preferredDate: futureDate,
        preferredTime: '02:00 PM - 03:00 PM EST',
        meetingFormat: 'Virtual Video Session (Zoom / Meet)',
        message: 'Exploring marine waste collection robotics feasibility.'
      })
    });

    assert.ok(res.status === 201 || res.status === 503, `Status was ${res.status}`);
    const data = await res.json();

    if (res.status === 201) {
      assert.strictEqual(data.success, true);
      assert.ok(data.referenceId.startsWith('PV-REQ-'), 'Reference ID must follow PV-REQ prefix pattern');
      assert.strictEqual(data.status, 'pending_review', 'Status must be strictly pending_review, never falsely confirmed');
      assert.ok(data.message.includes('pending review'), 'Message must explain that appointment is pending review');
    } else {
      assert.strictEqual(data.success, false);
    }
  });
});
