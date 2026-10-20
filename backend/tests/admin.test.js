/**
 * PUVIMA Consultancy — Admin & Settings API Test Suite
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;
let adminToken;

describe('Admin & Settings API Test Suite', () => {
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

  test('POST /api/admin/login rejects invalid credentials with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@puvima.com', password: 'wrongpassword' })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('POST /api/admin/login returns valid token for correct credentials', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@puvima.com', password: 'admin123' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token, 'Token must be returned');
    assert.strictEqual(data.user.role, 'admin');

    adminToken = data.token;
  });

  test('GET /api/admin/contacts rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/contacts`);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/admin/contacts returns inquiries with valid token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/contacts`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.contacts));
  });

  test('GET /api/site-settings returns public settings without authentication', async () => {
    const res = await fetch(`${baseUrl}/api/site-settings`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.settings.announcement);
    assert.ok(data.settings.hero);
  });

  test('PUT /api/admin/settings updates settings with valid token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        hero: {
          headlineMain: 'NextGen Innovation.'
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.settings.hero.headlineMain, 'NextGen Innovation.');

    // Restore clean headline
    await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        hero: { headlineMain: 'Innovation.' },
        announcement: { enabled: false, text: '' }
      })
    });
  });

  test('POST /api/reviews submits a pending customer review from the main page', async () => {
    const res = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Samantha Wright',
        company: 'Autonomous Robotics Inc',
        rating: 5,
        platform: 'google',
        review_text: 'Outstanding technical advisory and SLAM sensor integration!'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.review.status, 'pending');
    assert.ok(data.review.reference_id.startsWith('REV-2026-'));
  });

  test('GET /api/reviews only returns approved reviews to the public main page', async () => {
    const res = await fetch(`${baseUrl}/api/reviews`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const hasPending = data.reviews.some(r => r.status !== 'approved');
    assert.strictEqual(hasPending, false, 'No unapproved reviews should be exposed publicly');
  });

  test('PATCH /api/admin/reviews/:id approves review and pushes to main page', async () => {
    // 1. Submit a fresh pending review
    const postRes = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jordan Lee',
        company: 'FinTech Algorithmic',
        rating: 5,
        platform: 'linkedin',
        review_text: 'Remarkable quantitative execution and backtesting precision.'
      })
    });
    const postData = await postRes.json();
    const refId = postData.review.reference_id;

    // 2. Admin pushes review to main page
    const patchRes = await fetch(`${baseUrl}/api/admin/reviews/${refId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.review.status, 'approved');

    // 3. Verify it is now live in public reviews
    const publicRes = await fetch(`${baseUrl}/api/reviews`);
    const publicData = await publicRes.json();
    const isNowPublic = publicData.reviews.some(r => r.reference_id === refId);
    assert.strictEqual(isNowPublic, true, 'Approved review must be visible in public reviews');
  });
});
