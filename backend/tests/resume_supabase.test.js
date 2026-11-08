const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const internshipService = require('../src/services/internship.service');
const internshipController = require('../src/controllers/internship.controller');

test('Candidate Resume Supabase Persistence & HR Retrieval Flow', async (t) => {
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test Resume) >>\nendobj\ntrailer\n<< >>\n%%EOF');
  const dummyFile = {
    buffer: dummyPdfBuffer,
    originalname: 'john_doe_resume.pdf',
    mimetype: 'application/pdf',
    size: dummyPdfBuffer.length
  };

  const appPayload = {
    full_name: 'John Doe Testing',
    email: `john.doe.${Date.now()}@example.com`,
    phone: '+91 98765 43210',
    city_state: 'Chennai, Tamil Nadu',
    college: 'Anna University',
    degree: 'B.Tech Information Technology',
    study_year: '3rd Year',
    graduation_year: '2026',
    cgpa_range: '8.0–8.9 CGPA / 80–89%',
    internship_role: 'Web Development',
    skills: ['Node.js', 'React', 'PostgreSQL'],
    strongest_skills: 'Node.js, Express, React, PostgreSQL in production',
    motivation: 'Passionate about full stack development and building scalable applications.',
    expected_contribution: 'Dedicated contribution to client projects and development.',
    internship_mode: 'Remote',
    duration: '2–3 months',
    joining_availability: 'Immediately',
    weekly_hours: '20–30 hours',
    referral_source: 'LinkedIn',
    consent_given: 1
  };

  let refId = null;

  await t.test('1. Submits application with PDF resume and sets resume metadata', async () => {
    const res = await internshipService.submitApplication(appPayload, dummyFile);
    assert.strictEqual(res.success, true);
    assert.ok(res.referenceId, 'Should have a reference ID');
    assert.strictEqual(res.resumeFilename, 'john_doe_resume.pdf');
    refId = res.referenceId;
  });

  await t.test('2. Admin gets application by reference ID', async () => {
    assert.ok(refId, 'refId should exist');
    const fetched = await internshipService.getApplicationByIdAdmin(refId);
    assert.ok(fetched, 'Should find application by reference ID');
    assert.strictEqual(fetched.email, appPayload.email);
    assert.strictEqual(fetched.resume_filename, 'john_doe_resume.pdf');
  });

  await t.test('3. HR retrieves resume via getApplicationResume controller method', async () => {
    let capturedStatus = 200;
    let capturedHeaders = {};
    let capturedData = null;
    let sentFile = null;

    const mockReq = {
      params: { id: refId },
      accepts: (type) => false
    };

    const mockRes = {
      status(s) { capturedStatus = s; return this; },
      setHeader(name, val) { capturedHeaders[name] = val; return this; },
      send(data) { capturedData = data; return this; },
      sendFile(filePath) { sentFile = filePath; return this; },
      redirect(url) { capturedHeaders['Location'] = url; return this; }
    };

    await internshipController.getApplicationResume(mockReq, mockRes);

    assert.strictEqual(capturedStatus, 200, 'HTTP status should be 200');
    assert.strictEqual(capturedHeaders['Content-Type'], 'application/pdf', 'Content-Type should be application/pdf');
    assert.ok(
      capturedData || sentFile,
      'Either buffer data or file path should be returned to the client'
    );

    if (capturedData) {
      assert.ok(Buffer.isBuffer(capturedData), 'Data returned should be a buffer');
      assert.ok(capturedData.length > 0, 'Buffer should not be empty');
    } else if (sentFile) {
      assert.ok(fs.existsSync(sentFile), 'Local fallback file should exist on disk');
    }
  });
});
