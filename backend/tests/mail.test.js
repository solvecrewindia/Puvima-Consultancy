/**
 * Puvima IT Service and Research Consultancy — Mail API & Integration Test Suite
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;
let adminToken;

describe('Mail Application & API Test Suite', () => {
  before((t, done) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;

      // Acquire authentic admin session token
      fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@puvima.com', password: 'admin123' })
      })
        .then(res => res.json())
        .then(data => {
          adminToken = data.token;
          done();
        })
        .catch(done);
    });
  });

  after((t, done) => {
    server.close(done);
  });

  test('GET /mail serves the dedicated PUVIMA Mail web application', async () => {
    const res = await fetch(`${baseUrl}/mail`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('PUVIMA Mail') || html.includes('Gmail'));
    assert.ok(html.includes('id="gmailComposeDock"') || html.includes('id="composeModal"'));
    assert.ok(html.includes('id="emailListContainer"') || html.includes('id="messagesListContainer"'));
  });

  test('GET /api/mail/account rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/mail/account`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Authentication required'));
  });

  test('GET /api/mail/account returns account info and reveals no passwords', async () => {
    const res = await fetch(`${baseUrl}/api/mail/account`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.account);
    assert.ok(data.account.email);
    assert.strictEqual(typeof data.account.imap.configured, 'boolean');
    assert.strictEqual(typeof data.account.smtp.configured, 'boolean');
    // Ensure no password leaked
    assert.strictEqual(data.account.password, undefined);
    assert.strictEqual(data.account.imap.pass, undefined);
    assert.strictEqual(data.account.smtp.pass, undefined);
  });

  test('GET /api/mail/folders rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/mail/folders`);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/mail/folders returns folder list with valid admin token', async () => {
    const res = await fetch(`${baseUrl}/api/mail/folders`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.folders));
    assert.ok(data.folders.some(f => f.role === 'inbox'));
  });

  test('GET /api/mail/messages accepts pagination parameters and returns structured response', async () => {
    const res = await fetch(`${baseUrl}/api/mail/messages?folder=INBOX&page=1&limit=10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.messages));
    assert.strictEqual(data.page, 1);
    assert.strictEqual(data.limit, 10);
  });

  test('POST /api/mail/send rejects missing recipients with 400', async () => {
    const res = await fetch(`${baseUrl}/api/mail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        subject: 'Test without recipient',
        text: 'Hello world'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('required'));
  });
});

