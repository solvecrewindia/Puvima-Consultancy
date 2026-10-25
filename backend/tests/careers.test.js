/**
 * PUVIMA Consultancy — Careers & Recruitment API Test Suite
 * Tests public positions, applications submission, security checks, admin controls, and resume downloads.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;
let adminToken;
let testPositionId;
let testPositionRef;
let testAppRef;
let testAppId;

describe('Careers & Recruitment API Test Suite', () => {
  before((t, done) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;

      // Authenticate admin to get token
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

  after(async () => {
    try {
      const careersService = require('../src/services/careers.service');
      if (testPositionId) await careersService.deletePosition(testPositionId);
      const data = careersService.readCareersFile();
      data.applications = (data.applications || []).filter(a => a.applicant_email !== 'ramesh.kumar@nexusrobotics.org');
      data.positions = (data.positions || []).filter(p => !p.title.includes('Robotics & Autonomous Navigation Engineer'));
      careersService.writeCareersFile(data);
    } catch (e) {}
    await new Promise(r => server.close(r));
  });

  // ==========================================================================
  // 1. PUBLIC POSITIONS LISTING & DETAILS
  // ==========================================================================

  test('GET /api/careers returns published positions without authentication', async () => {
    const res = await fetch(`${baseUrl}/api/careers`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.positions), 'positions must be an array');
  });

  test('GET /api/careers/non-existent returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/careers/JOB-999999`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // ==========================================================================
  // 2. ADMIN AUTHORIZATION & POSITION MANAGEMENT
  // ==========================================================================

  test('GET /api/admin/careers rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/careers`);
    assert.strictEqual(res.status, 401);
  });

  test('POST /api/admin/careers rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/careers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' })
    });
    assert.strictEqual(res.status, 401);
  });

  test('POST /api/admin/careers rejects missing required fields with 400', async () => {
    const res = await fetch(`${baseUrl}/api/admin/careers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ title: '' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errors, 'Validation errors must be returned');
  });

  test('POST /api/admin/careers creates a new position successfully', async () => {
    const payload = {
      title: 'Robotics & Autonomous Navigation Engineer',
      department: 'Robotics & Autonomous Systems',
      description: 'Lead design and sensor fusion algorithms for industrial autonomous mobile robots.',
      responsibilities: 'Develop ROS2 navigation stacks, sensor fusion with LiDAR/IMU, SLAM testing.',
      required_skills: 'ROS2, C++, Python, Kalman Filtering, SLAM, Linux',
      employment_type: 'Full-time',
      work_arrangement: 'Hybrid',
      location: 'Chennai, India',
      experience_requirements: '3+ Years',
      salary_range: 'Competitive Enterprise Band',
      status: 'draft'
    };

    const res = await fetch(`${baseUrl}/api/admin/careers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.position.id, 'Position ID must be generated');
    assert.ok(data.position.reference_id, 'Reference ID must be generated');
    assert.strictEqual(data.position.status, 'draft');

    testPositionId = data.position.id;
    testPositionRef = data.position.reference_id;
  });

  test('Draft position is not visible in public GET /api/careers', async () => {
    const res = await fetch(`${baseUrl}/api/careers`);
    const data = await res.json();
    const found = data.positions.some(p => p.reference_id === testPositionRef);
    assert.strictEqual(found, false, 'Draft position must not be exposed to the public');
  });

  test('PUT /api/admin/careers/:id updates position details', async () => {
    const res = await fetch(`${baseUrl}/api/admin/careers/${testPositionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        experience_requirements: '4+ Years Experience'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.position.experience_requirements, '4+ Years Experience');
  });

  test('PATCH /api/admin/careers/:id/status publishes the position', async () => {
    const res = await fetch(`${baseUrl}/api/admin/careers/${testPositionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'published' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.position.status, 'published');
  });

  test('Published position is now returned in public GET /api/careers', async () => {
    const res = await fetch(`${baseUrl}/api/careers`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const found = data.positions.some(p => p.reference_id === testPositionRef);
    assert.strictEqual(found, true, 'Published position must appear in public list');
  });

  test('GET /api/careers/:id retrieves single published position details', async () => {
    const res = await fetch(`${baseUrl}/api/careers/${testPositionId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.position.title, 'Robotics & Autonomous Navigation Engineer');
  });

  // ==========================================================================
  // 3. CANDIDATE APPLICATION SUBMISSIONS & VALIDATION
  // ==========================================================================

  test('POST /api/careers/:id/apply rejects missing required form fields with 400', async () => {
    const form = new FormData();
    form.append('applicant_name', '');
    form.append('applicant_email', 'not-an-email');
    // missing resume and phone

    const res = await fetch(`${baseUrl}/api/careers/${testPositionId}/apply`, {
      method: 'POST',
      body: form
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('resume') || data.errors);
  });

  test('POST /api/careers/:id/apply rejects file without valid PDF/DOC signature', async () => {
    const form = new FormData();
    form.append('applicant_name', 'Alex Mercer');
    form.append('applicant_email', 'alex.mercer@example.com');
    form.append('applicant_phone', '+91 98765 43210');
    form.append('consent', 'true');

    // Fake PDF with invalid text content (not starting with %PDF-)
    const fakeBlob = new Blob(['THIS IS PLAIN TEXT NOT A REAL PDF FILE'], { type: 'application/pdf' });
    form.append('resume', fakeBlob, 'fake_resume.pdf');

    const res = await fetch(`${baseUrl}/api/careers/${testPositionId}/apply`, {
      method: 'POST',
      body: form
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('contents do not match') || data.message.includes('signature') || data.message.includes('format'));
  });

  test('POST /api/careers/:id/apply rejects unsupported file extensions', async () => {
    const form = new FormData();
    form.append('applicant_name', 'Alex Mercer');
    form.append('applicant_email', 'alex.mercer@example.com');
    form.append('applicant_phone', '+91 98765 43210');
    form.append('consent', 'true');

    const fakeExeBlob = new Blob(['MZ\x90\x00\x03\x00\x00\x00'], { type: 'application/octet-stream' });
    form.append('resume', fakeExeBlob, 'malicious_script.exe');

    const res = await fetch(`${baseUrl}/api/careers/${testPositionId}/apply`, {
      method: 'POST',
      body: form
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Unsupported') || data.message.includes('type'));
  });

  test('POST /api/careers/:id/apply successfully processes valid application with authentic PDF resume', async () => {
    const form = new FormData();
    form.append('applicant_name', 'Dr. Ramesh Kumar');
    form.append('applicant_email', 'ramesh.kumar@nexusrobotics.org');
    form.append('applicant_phone', '+91 98401 23456');
    form.append('education', 'Ph.D. in Autonomous Systems, IIT Madras');
    form.append('skills', 'ROS2, Nav2, C++, PyTorch, Sensor Fusion, SLAM');
    form.append('experience_years', '5 Years');
    form.append('linkedin_url', 'https://linkedin.com/in/ramesh-kumar-sample');
    form.append('portfolio_url', 'https://github.com/ramesh-kumar-sample');
    form.append('cover_letter', 'I have 5 years experience engineering sensor fusion pipelines for industrial AMRs and would love to contribute to PUVIMA.');
    form.append('consent', 'true');

    // Authentic PDF file with %PDF- header magic bytes
    const validPdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, // %PDF-1.4\n
      0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,                   // binary comment
      0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,       // 1 0 obj
      0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x3e, 0x3e, 0x0a,
      0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,             // endobj
      0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,       // trailer
      0x3c, 0x3c, 0x2f, 0x53, 0x69, 0x7a, 0x65, 0x20, 0x32, 0x3e, 0x3e, 0x0a,
      0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a                    // %%EOF
    ]);

    const validBlob = new Blob([validPdfBytes], { type: 'application/pdf' });
    form.append('resume', validBlob, 'Ramesh_Kumar_Resume.pdf');

    const res = await fetch(`${baseUrl}/api/careers/${testPositionId}/apply`, {
      method: 'POST',
      body: form
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.referenceId, 'Reference ID must be issued');
    assert.strictEqual(data.status, 'received');
    assert.ok(data.message.includes(data.referenceId));

    testAppRef = data.referenceId;
  });

  test('POST /api/careers/999999/apply rejects applying for non-existent position with 404', async () => {
    const form = new FormData();
    form.append('applicant_name', 'Test User');
    form.append('applicant_email', 'test@example.com');
    form.append('applicant_phone', '+91 99999 88888');
    form.append('consent', 'true');
    const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    form.append('resume', new Blob([validPdfBytes], { type: 'application/pdf' }), 'test.pdf');

    const res = await fetch(`${baseUrl}/api/careers/999999/apply`, {
      method: 'POST',
      body: form
    });

    assert.strictEqual(res.status, 404);
  });

  // ==========================================================================
  // 4. CLOSED POSITIONS BEHAVIOR
  // ==========================================================================

  test('PATCH /api/admin/careers/:id/status closes position and prevents new applications', async () => {
    // 1. Close position
    const closeRes = await fetch(`${baseUrl}/api/admin/careers/${testPositionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'closed' })
    });
    assert.strictEqual(closeRes.status, 200);

    // 2. Try applying to closed position
    const form = new FormData();
    form.append('applicant_name', 'Late Applicant');
    form.append('applicant_email', 'late@example.com');
    form.append('applicant_phone', '+91 99999 88888');
    form.append('consent', 'true');
    const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    form.append('resume', new Blob([validPdfBytes], { type: 'application/pdf' }), 'test.pdf');

    const applyRes = await fetch(`${baseUrl}/api/careers/${testPositionId}/apply`, {
      method: 'POST',
      body: form
    });

    assert.strictEqual(applyRes.status, 404);
    const data = await applyRes.json();
    assert.strictEqual(data.success, false);
  });

  // ==========================================================================
  // 5. ADMIN APPLICATIONS MANAGEMENT & SECURE RESUME ACCESS
  // ==========================================================================

  test('GET /api/admin/applications rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/applications`);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/admin/applications returns applications list with valid admin token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/applications`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.applications));

    const submitted = data.applications.find(a => a.reference_id === testAppRef);
    assert.ok(submitted, 'Submitted application must be found in admin applications list');
    assert.strictEqual(submitted.applicant_name, 'Dr. Ramesh Kumar');
    assert.strictEqual(submitted.recruitment_status, 'received');

    testAppId = submitted.id;
  });

  test('GET /api/admin/applications/:id retrieves specific application details', async () => {
    const res = await fetch(`${baseUrl}/api/admin/applications/${testAppId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.application.reference_id, testAppRef);
    assert.strictEqual(data.application.applicant_email, 'ramesh.kumar@nexusrobotics.org');
  });

  test('PATCH /api/admin/applications/:id/status updates recruitment status and notes', async () => {
    const res = await fetch(`${baseUrl}/api/admin/applications/${testAppId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'shortlisted',
        admin_notes: 'Strong candidate with impressive SLAM portfolio. Proceeding to technical interview.'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.application.recruitment_status, 'shortlisted');
    assert.strictEqual(data.application.admin_notes, 'Strong candidate with impressive SLAM portfolio. Proceeding to technical interview.');
  });

  test('GET /api/admin/applications/:id/resume rejects unauthenticated access with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/applications/${testAppId}/resume`);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/admin/applications/:id/resume securely serves resume to authorized admin', async () => {
    const res = await fetch(`${baseUrl}/api/admin/applications/${testAppId}/resume`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('application/pdf'), 'Must serve correct PDF content-type');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');

    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 0, 'Downloaded file must contain bytes');
    const bytes = new Uint8Array(buffer);
    assert.strictEqual(bytes[0], 0x25); // %
    assert.strictEqual(bytes[1], 0x50); // P
    assert.strictEqual(bytes[2], 0x44); // D
    assert.strictEqual(bytes[3], 0x46); // F
  });
});
