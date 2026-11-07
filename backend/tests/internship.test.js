/**
 * PUVIMA Consultancy — Internship Application System Test Suite
 * Tests multi-step questionnaire validation, authentic resume file storage,
 * MySQL/JSON persistence, removal of recruitment email dispatches,
 * HR Portal review & lifecycle tracking, Super Admin oversight,
 * status transition audit history, and RBAC security enforcement.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;
let adminToken;
let createdAppRef;
let createdAppId;

// Construct a valid authentic PDF buffer (%PDF-1.4 header)
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Title (Candidate Resume) /Creator (LaTeX) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
);

// Fake executable disguised as PDF
const FAKE_EXE_BUFFER = Buffer.from('MZ\x90\x00\x03\x00\x00\x00ThisIsAnExecutableFileDisguisedAsPDF');

describe('PUVIMA Internship Application System Test Suite', () => {
  before((t, done) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;

      // Login admin to obtain authorization token
      fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@puvima.com', password: 'admin123' })
      })
        .then((res) => res.json())
        .then((data) => {
          adminToken = data.token;
          done();
        })
        .catch(done);
    });
  });

  after(async () => {
    await new Promise((r) => server.close(r));
  });

  // ==========================================================================
  // 1. PUBLIC SUBMISSION VALIDATIONS
  // ==========================================================================

  test('POST /api/internship-applications rejects empty submission with 400', async () => {
    const res = await fetch(`${baseUrl}/api/internship-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errors);
  });

  test('POST /api/internship-applications rejects submission missing resume file', async () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const formPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="full_name"',
      '',
      'Kavitha Sundaram',
      `--${boundary}`,
      'Content-Disposition: form-data; name="email"',
      '',
      'kavitha@example.com',
      `--${boundary}--`
    ].join('\r\n');

    const res = await fetch(`${baseUrl}/api/internship-applications`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: formPayload
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errors && data.errors.resume);
  });

  test('POST /api/internship-applications rejects executable disguised as PDF', async () => {
    const boundary = '----WebKitFormBoundaryDisguisedExe';
    const bodyBuffers = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="full_name"\r\n\r\nKavitha Sundaram\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="email"\r\n\r\nkavitha@example.com\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="phone"\r\n\r\n+91 98765 43210\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="city_state"\r\n\r\nChennai, Tamil Nadu\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="college"\r\n\r\nAnna University\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="degree"\r\n\r\nB.Tech Robotics\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="study_year"\r\n\r\n3rd Year\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="graduation_year"\r\n\r\n2027\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="cgpa_range"\r\n\r\n8.0–8.9 CGPA / 80–89%\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="internship_role"\r\n\r\nRobotics\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="skills"\r\n\r\n["Python","C / C++","Machine Learning / AI"]\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="strongest_skills"\r\n\r\nROS2 navigation, computer vision, kinematics\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="motivation"\r\n\r\nEager to contribute to autonomous systems research.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="expected_contribution"\r\n\r\nStrong mathematics foundation and embedded programming.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="internship_mode"\r\n\r\nHybrid\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="duration"\r\n\r\n3–6 months\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="joining_availability"\r\n\r\nImmediately\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="weekly_hours"\r\n\r\n20–30 hours\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="referral_source"\r\n\r\nLinkedIn\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\ntrue\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      FAKE_EXE_BUFFER,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];

    const fullPayload = Buffer.concat(bodyBuffers);

    const res = await fetch(`${baseUrl}/api/internship-applications`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: fullPayload
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errors && data.errors.resume);
  });

  test('POST /api/internship-applications successfully accepts complete application, defaults status to New, and sends zero emails', async () => {
    const boundary = '----WebKitFormBoundaryValidCandidateApp';
    const bodyBuffers = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="full_name"\r\n\r\nArunachalam Venkatesh\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="email"\r\n\r\narun.venkatesh@example.com\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="phone"\r\n\r\n+91 93847 87701\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="city_state"\r\n\r\nChennai, Tamil Nadu\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="linkedin_url"\r\n\r\nhttps://www.linkedin.com/in/arunvenkatesh\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="college"\r\n\r\nMadras Institute of Technology\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="degree"\r\n\r\nB.E. Computer Science and Engineering\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="study_year"\r\n\r\n3rd Year\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="graduation_year"\r\n\r\n2027\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="cgpa_range"\r\n\r\n9.0–10 CGPA / 90% or above\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="internship_role"\r\n\r\nRobotics\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="skills"\r\n\r\n["Python","C / C++","Machine Learning / AI","SQL / Databases"]\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="strongest_skills"\r\n\r\nAutonomous navigation, SLAM algorithms, sensor integration, and PyTorch.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="projects_experience"\r\n\r\nDeveloped autonomous mobile robot using ROS2 with LiDAR SLAM mapping.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="github_portfolio_url"\r\n\r\nhttps://github.com/arunvenkatesh\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="motivation"\r\n\r\nPassionate about PUVIMA's multidisciplinary robotics and autonomous systems work.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="expected_contribution"\r\n\r\nHigh energy, solid mathematical foundations, and active open source contributions.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="internship_mode"\r\n\r\nHybrid\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="duration"\r\n\r\n3–6 months\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="joining_availability"\r\n\r\nOn a specific future date\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="specific_joining_date"\r\n\r\n2026-12-01\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="weekly_hours"\r\n\r\n20–30 hours\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="referral_source"\r\n\r\nCollege Placement Cell\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="additional_information"\r\n\r\nInterested in working on ROS2 and embedded systems research.\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\ntrue\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="Arun_Venkatesh_Resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      VALID_PDF_BUFFER,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];

    const fullPayload = Buffer.concat(bodyBuffers);

    const res = await fetch(`${baseUrl}/api/internship-applications`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: fullPayload
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.referenceId.startsWith('PUV-INT-'));
    assert.strictEqual(data.resumeFilename, 'Arun_Venkatesh_Resume.pdf');

    createdAppRef = data.referenceId;
    createdAppId = data.applicationId;
  });

  // ==========================================================================
  // 2. HR PORTAL ENDPOINTS & HR REVIEW WORKFLOW
  // ==========================================================================

  test('GET /api/hr/internship-applications rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications`);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/hr/internship-applications returns application list for HR role', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications`, {
      headers: {
        'x-portal-user-role': 'HR',
        'x-portal-user-id': 'HR001',
        'x-portal-user-name': 'Priya HR'
      }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.applications));
    const target = data.applications.find((a) => a.reference_id === createdAppRef);
    assert.ok(target, 'Created application should be present in HR list');
    assert.strictEqual(target.recruitment_status, 'New');
    assert.strictEqual(target.is_reviewed_by_hr, 0, 'New application should not yet be reviewed');
  });

  test('GET /api/hr/internship-applications/stats returns counts for all 6 statuses and unread', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications/stats`, {
      headers: {
        'x-portal-user-role': 'HR',
        'x-portal-user-id': 'HR001'
      }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.stats);
    assert.ok(data.stats.total >= 1);
    assert.ok(data.stats.new >= 1);
    assert.ok(data.stats.unread_by_hr >= 1);
  });

  test('GET /api/hr/internship-applications/:id retrieves candidate details for HR', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications/${createdAppRef}`, {
      headers: {
        'x-portal-user-role': 'HR',
        'x-portal-user-id': 'HR001'
      }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.application.reference_id, createdAppRef);
    assert.strictEqual(data.application.full_name, 'Arunachalam Venkatesh');
    assert.strictEqual(data.application.college, 'Madras Institute of Technology');
  });

  test('PATCH /api/hr/internship-applications/:id/reviewed marks application as reviewed by HR', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications/${createdAppRef}/reviewed`, {
      method: 'PATCH',
      headers: {
        'x-portal-user-role': 'HR',
        'x-portal-user-id': 'HR001',
        'x-portal-user-name': 'Priya HR'
      }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.application.is_reviewed_by_hr, 1);
    assert.strictEqual(data.application.hr_reviewed_by, 'Priya HR');
    assert.ok(data.application.hr_reviewed_at);
  });

  test('PATCH /api/hr/internship-applications/:id/status transitions status to Under Review', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications/${createdAppRef}/status`, {
      method: 'PATCH',
      headers: {
        'x-portal-user-role': 'HR',
        'x-portal-user-id': 'HR001',
        'x-portal-user-name': 'Priya HR',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'Under Review',
        notes: 'Initial profile screening completed. Passing to Technical Lead.'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.application.recruitment_status, 'Under Review');
  });

  test('GET /api/hr/internship-applications/:id/resume securely streams candidate resume to HR', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications/${createdAppRef}/resume`, {
      headers: {
        'x-portal-user-role': 'HR',
        'x-portal-user-id': 'HR001'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('pdf'));
  });

  // ==========================================================================
  // 3. SUPER ADMIN ENDPOINTS & AUDIT HISTORY
  // ==========================================================================

  test('GET /api/admin/internship-applications returns application list with valid admin token', async () => {
    const res = await fetch(`${baseUrl}/api/admin/internship-applications`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.applications));
    const target = data.applications.find((a) => a.reference_id === createdAppRef);
    assert.ok(target);
    assert.strictEqual(target.recruitment_status, 'Under Review');
    assert.strictEqual(target.is_reviewed_by_hr, 1);
  });

  test('GET /api/admin/internship-applications filters by status, role, and search', async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/internship-applications?role=Robotics&status=Under Review&search=Arunachalam`,
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.applications.some((a) => a.reference_id === createdAppRef));
  });

  test('PATCH /api/admin/internship-applications/:id/status updates status to Interview with confidential notes', async () => {
    const res = await fetch(`${baseUrl}/api/admin/internship-applications/${createdAppRef}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'Interview',
        notes: 'Executive approved for final technical interview on December 2.'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.application.recruitment_status, 'Interview');
  });

  test('GET /api/admin/internship-applications/:id/history returns immutable status audit trail', async () => {
    const res = await fetch(`${baseUrl}/api/admin/internship-applications/${createdAppRef}/history`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.history));
    assert.ok(data.history.length >= 3, 'History should log submission, HR status change, and Admin status change');

    // Verify first event is submission
    assert.strictEqual(data.history[0].new_status, 'New');

    // Verify subsequent transitions
    const hrEvent = data.history.find((h) => h.new_status === 'Under Review');
    assert.ok(hrEvent);
    assert.strictEqual(hrEvent.changed_by_role, 'HR');

    const adminEvent = data.history.find((h) => h.new_status === 'Interview');
    assert.ok(adminEvent);
    assert.strictEqual(adminEvent.changed_by_role, 'SuperAdmin');
    assert.ok(adminEvent.notes.includes('Executive approved'));
  });

  test('PATCH /api/admin/internship-applications/:id/status rejects invalid status with 400', async () => {
    const res = await fetch(`${baseUrl}/api/admin/internship-applications/${createdAppRef}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'invalid_status_value'
      })
    });

    assert.strictEqual(res.status, 400);
  });

  // ==========================================================================
  // 4. RBAC PRIVILEGE ENFORCEMENT
  // ==========================================================================

  test('GET /api/hr/internship-applications strictly rejects Employee role with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/hr/internship-applications`, {
      headers: {
        'x-portal-user-role': 'Employee',
        'x-portal-user-id': 'EMP001'
      }
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Forbidden'));
  });

  test('GET /api/admin/internship-applications strictly rejects Intern role with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/admin/internship-applications`, {
      headers: {
        'x-portal-user-role': 'Intern',
        'x-portal-user-id': 'INT001'
      }
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Forbidden'));
  });
});
