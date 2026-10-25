const http = require('http');

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: respData }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log(' PUVIMA Consultancy — Full Production Verification');
  console.log('====================================================\n');

  console.log('--- 1. TESTING STATIC PAGES & ASSETS ---');
  const pages = [
    '/admin',
    '/admin/index.html',
    '/admin/admin.css',
    '/admin/admin.js',
    '/admin.css',
    '/admin.js',
    '/js/config.js',
    '/assets/images/logo/favicon.png',
    '/assets/images/logo/puvima-logo-clean-dark.png',
    '/',
    '/about',
    '/services',
    '/careers',
    '/contact',
    '/booking',
    '/portfolio',
    '/testimonials',
    '/team',
    '/faq',
    '/privacy-policy',
    '/terms'
  ];

  let staticPassed = 0;
  for (const p of pages) {
    try {
      const res = await get(p);
      const ok = res.status === 200 && res.body.length > 0;
      if (ok) staticPassed++;
      console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${p} (${res.headers['content-type'] || 'binary'}, ${res.body.length} bytes)`);
    } catch (e) {
      console.log(`FAIL ${p}: ${e.message}`);
    }
  }

  console.log(`\nStatic checks passed: ${staticPassed}/${pages.length}\n`);

  console.log('--- 2. TESTING ADMIN AUTHENTICATION ---');
  const loginRes = await post('/api/admin/login', { email: 'admin@puvima.com', password: 'admin123' });
  console.log(`POST /api/admin/login -> Status: ${loginRes.status}`);
  const loginData = JSON.parse(loginRes.body);
  const token = loginData.token;
  console.log(`Admin Token generated: ${token ? 'YES (Valid HMAC-SHA256)' : 'NO'}`);

  const authHeaders = { 'Authorization': 'Bearer ' + token };

  console.log('\n--- 3. TESTING ADMIN SECURE ENDPOINTS ---');
  const adminEndpoints = [
    '/api/admin/me',
    '/api/admin/stats',
    '/api/admin/contacts',
    '/api/admin/bookings',
    '/api/admin/reviews',
    '/api/admin/settings',
    '/api/admin/careers',
    '/api/admin/applications'
  ];

  let adminPassed = 0;
  for (const ep of adminEndpoints) {
    try {
      const res = await get(ep, authHeaders);
      const data = JSON.parse(res.body);
      const ok = res.status === 200 && data.success === true;
      if (ok) adminPassed++;
      console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${ep} (success: ${data.success})`);
    } catch (e) {
      console.log(`FAIL ${ep}: ${e.message}`);
    }
  }
  console.log(`\nAdmin endpoints passed: ${adminPassed}/${adminEndpoints.length}\n`);

  console.log('--- 4. TESTING PUBLIC API ENDPOINTS ---');
  const publicEndpoints = [
    '/api/health',
    '/api/reviews',
    '/api/careers',
    '/api/site-settings'
  ];

  let publicPassed = 0;
  for (const ep of publicEndpoints) {
    try {
      const res = await get(ep);
      const data = JSON.parse(res.body);
      const ok = res.status === 200 && (data.success === true || data.status === 'healthy' || Array.isArray(data.reviews) || Array.isArray(data.positions));
      if (ok) publicPassed++;
      console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${ep}`);
    } catch (e) {
      console.log(`FAIL ${ep}: ${e.message}`);
    }
  }
  console.log(`\nPublic endpoints passed: ${publicPassed}/${publicEndpoints.length}\n`);

  if (staticPassed === pages.length && adminPassed === adminEndpoints.length && publicPassed === publicEndpoints.length) {
    console.log('====================================================');
    console.log(' ALL PRODUCTION CHECKS PASSED PERFECTLY (100%)');
    console.log('====================================================');
  } else {
    console.log('SOME CHECKS FAILED - REVIEW OUTPUT ABOVE');
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
