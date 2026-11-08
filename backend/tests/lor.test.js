/**
 * PUVIMA Consultancy — Letter of Recommendation (LOR) Automated Test Suite
 * Validates intern LOR submission, professor email generation, token verification,
 * professor endorsement confirmation, HR approval, and PDF generation.
 */

const test = require('node:test');
const assert = require('node:assert');
const lorService = require('../src/services/lor.service');
const lorPdfService = require('../src/services/lorPdf.service');

test('PUVIMA Letter of Recommendation (LOR) End-to-End Test Suite', async (t) => {

  const testIntern = {
    id: 'intern-test-uuid-1234',
    name: 'Ananya Sharma',
    email: 'ananya.intern@puvima.com',
    phone: '+91 9876543210'
  };

  let createdLor = null;

  await t.test('1. Intern creates LOR request with designated Professor details', async () => {
    const payload = {
      domain_specialization: 'Artificial Intelligence & Robotics',
      college_university: 'National Institute of Technology',
      department_branch: 'Computer Science & Engineering',
      internship_start_date: '2026-01-01',
      internship_end_date: '2026-06-30',
      project_title: 'Multi-Agent Autonomous Path Planning with ROS2',
      project_deliverables: 'Designed hierarchical path-planning algorithms and multi-agent coordination telemetry.',
      purpose_of_lor: 'Higher Studies (MS in Robotics, Fall 2026)',

      professor_name: 'Dr. K. Rajesh Kumar',
      professor_designation: 'Professor & Head of Department',
      professor_institution: 'National Institute of Technology',
      professor_department: 'Department of Computer Science & Engineering',
      professor_phone: '+91 9443218765',
      professor_email: 'rajesh.kumar@nit.ac.in',
      academic_relationship: 'Project Guide & Supervisor'
    };

    createdLor = await lorService.submitLorRequest(testIntern, payload);

    assert.ok(createdLor, 'LOR request should be created');
    assert.ok(createdLor.id, 'LOR should have UUID');
    assert.match(createdLor.lor_request_id, /^PV-LOR-\d{4}-[A-F0-9]{6}$/, 'LOR ID must match PV-LOR-YYYY-XXXXXX format');
    assert.strictEqual(createdLor.intern_email, testIntern.email);
    assert.strictEqual(createdLor.professor_name, 'Dr. K. Rajesh Kumar');
    assert.ok(createdLor.verification_token, 'Secure verification token must be generated');
  });

  await t.test('2. Dispatches automated verification email to professor', async () => {
    const hostOrigin = 'http://localhost:5000';
    const emailResult = await lorService.sendProfessorVerificationEmail(createdLor.id, hostOrigin);

    assert.ok(emailResult.success);
    assert.strictEqual(emailResult.status, 'Email Sent to Professor');
    assert.ok(emailResult.confirmation_url.includes(createdLor.verification_token), 'Confirmation URL must include token');
  });

  await t.test('3. Professor verification endpoint loads candidate profile details by token', async () => {
    const verifyData = await lorService.getLorByToken(createdLor.verification_token);

    assert.ok(verifyData);
    assert.strictEqual(verifyData.intern_name, testIntern.name);
    assert.strictEqual(verifyData.professor_name, 'Dr. K. Rajesh Kumar');
    assert.strictEqual(verifyData.project_title, 'Multi-Agent Autonomous Path Planning with ROS2');
  });

  await t.test('4. Professor confirms and endorses intern recommendation', async () => {
    const endorsement = {
      remarks: 'Ananya is an exceptional researcher with profound analytical capabilities and exemplary work ethic.',
      rating: 'Strongly Recommended (Top 5%)',
      ipAddress: '192.168.1.100'
    };

    const confirmResult = await lorService.confirmByProfessor(createdLor.verification_token, endorsement);

    assert.ok(confirmResult.success);
    assert.ok(confirmResult.confirmed_at);

    // Verify stored state
    const updated = await lorService.getLorByInternEmail(testIntern.email);
    assert.strictEqual(updated.status, 'Confirmed by Professor');
    assert.strictEqual(updated.professor_rating, 'Strongly Recommended (Top 5%)');
    assert.strictEqual(updated.professor_ip_address, '192.168.1.100');
  });

  await t.test('5. HR views LOR requests and sees professor endorsement status', async () => {
    const hrResult = await lorService.getHrLorRequests({ status: 'Confirmed by Professor' });

    assert.ok(hrResult.requests.length >= 1);
    const item = hrResult.requests.find(r => r.id === createdLor.id);
    assert.ok(item);
    assert.strictEqual(item.status, 'Confirmed by Professor');
    assert.ok(item.professor_confirmed_at);
  });

  await t.test('6. HR approves and officially issues the Letter of Recommendation', async () => {
    const hrUser = { name: 'Dr. P. Sundaram', email: 'admin@puvima.com' };
    const approved = await lorService.approveByHr(createdLor.id, hrUser, { hrRemarks: 'All academic credentials and mentor endorsement verified.' });

    assert.strictEqual(approved.status, 'HR Approved');
    assert.strictEqual(approved.hr_verified_by, 'Dr. P. Sundaram');
    assert.ok(approved.hr_verified_at);
  });

  await t.test('7. PDF generation service produces official PUVIMA Letter of Recommendation document', async () => {
    const fullLor = await lorService.getLorByInternEmail(testIntern.email);
    const pdfBuffer = await lorPdfService.generatePdfBuffer(fullLor);

    assert.ok(pdfBuffer instanceof Buffer, 'Should generate a valid Buffer');
    assert.ok(pdfBuffer.length > 2000, 'PDF buffer should be substantive');
    const headerString = pdfBuffer.slice(0, 5).toString('ascii');
    assert.strictEqual(headerString, '%PDF-', 'Buffer should start with PDF magic header %PDF-');
  });

});

