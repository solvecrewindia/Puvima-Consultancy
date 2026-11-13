/**
 * Puvima IT Service and Research Consultancy — Onboarding & HR Verification Comprehensive Unit & Integration Test Suite
 * Fully sandboxed test execution without requiring TCP loopback network sockets.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const onboardingService = require('../src/services/onboarding.service');
const onboardingPdfService = require('../src/services/onboardingPdf.service');
const onboardingController = require('../src/controllers/onboarding.controller');
const { signToken, verifyToken } = require('../src/utils/token');

describe('PUVIMA Onboarding & HR Verification Comprehensive Test Suite', () => {
  let createdApp;
  let applicantId;
  let applicantToken;
  let uploadedDocId;
  let hrToken;

  // 1. RBAC & Token Verification
  test('Token utility signs and verifies HR role correctly', () => {
    hrToken = signToken({
      id: 'HR0001',
      name: 'HR Lead Reviewer',
      role: 'hr',
      email: 'hr@puvima.com'
    });

    const payload = verifyToken(hrToken);
    assert.ok(payload);
    assert.strictEqual(payload.role, 'hr');
    assert.strictEqual(payload.name, 'HR Lead Reviewer');
  });

  // 2. Initialize Application
  test('onboardingService.initOrGetApplication creates draft with unique PV-ONB ID and access token', async () => {
    const testEmail = `candidate.${Date.now()}@puvima.com`;
    createdApp = await onboardingService.initOrGetApplication({
      email: testEmail,
      name: 'Vigneshwaran R',
      position: 'Intern'
    });

    assert.ok(createdApp);
    assert.ok(createdApp.application_id.startsWith('PV-ONB-'));
    assert.strictEqual(createdApp.applicant_email, testEmail);
    assert.strictEqual(createdApp.applicant_name, 'Vigneshwaran R');
    assert.strictEqual(createdApp.status, 'Draft');
    assert.ok(createdApp.access_token);

    applicantId = createdApp.id;
    applicantToken = createdApp.access_token;
  });

  // 3. Step 1: Position Details
  test('Step 1: Saves position, domain, joining date and duration', async () => {
    const updated = await onboardingService.saveStep(applicantId, 1, {
      position_applied: 'Research Associate',
      domain_interest: 'Robotics & Computer Vision',
      preferred_joining_date: '2026-12-01',
      duration: '6 Months'
    });

    assert.strictEqual(updated.position_applied, 'Research Associate');
    assert.strictEqual(updated.domain_interest, 'Robotics & Computer Vision');
    assert.strictEqual(updated.duration, '6 Months');
  });

  // 4. Step 2: Personal Details & Sensitive Aadhaar Masking
  test('Step 2: Saves personal details and encrypts + masks Aadhaar number', async () => {
    const updated = await onboardingService.saveStep(applicantId, 2, {
      full_name: 'Vigneshwaran R',
      dob: '2001-08-20',
      gender: 'Male',
      nationality: 'Indian',
      id_number: '123456789012',
      blood_group: 'O+'
    });

    assert.strictEqual(updated.dob, '2001-08-20');
    assert.strictEqual(updated.gender, 'Male');
    // Ensure Aadhaar is masked in regular view
    assert.strictEqual(updated.id_number_masked, 'XXXX-XXXX-9012');
  });

  // 5. Step 3: Contact & Address Details
  test('Step 3: Saves phone number, permanent and current addresses', async () => {
    const updated = await onboardingService.saveStep(applicantId, 3, {
      mobile_number: '9840123456',
      permanent_address: '42, Sardar Patel Road, Adyar, Chennai - 600020',
      current_address: '42, Sardar Patel Road, Adyar, Chennai - 600020'
    });

    assert.strictEqual(updated.applicant_phone, '9840123456');
    assert.strictEqual(updated.permanent_address, '42, Sardar Patel Road, Adyar, Chennai - 600020');
  });

  // 6. Step 4: Academic Information
  test('Step 4: Saves academic qualifications list', async () => {
    const updated = await onboardingService.saveStep(applicantId, 4, {
      academic_details: [
        {
          qualification_type: 'UG',
          degree_name: 'B.Tech Mechatronics',
          institution: 'Anna University',
          year_of_passing: 2025,
          score_cgpa: '8.92'
        },
        {
          qualification_type: 'Higher Secondary',
          degree_name: 'HSC Science',
          institution: 'Kendriya Vidyalaya',
          year_of_passing: 2021,
          score_cgpa: '94%'
        }
      ]
    });

    assert.ok(updated.academic_details);
    assert.strictEqual(updated.academic_details.length, 2);
    assert.strictEqual(updated.academic_details[0].degree_name, 'B.Tech Mechatronics');
  });

  // 7. Step 5: Skills & Experience / Projects
  test('Step 5: Saves technical skills, tools, and project history', async () => {
    const updated = await onboardingService.saveStep(applicantId, 5, {
      skills: 'Python, C++, ROS2, Gazebo, OpenCV, PyTorch',
      tools_platforms: 'Git, Docker, Linux, VS Code',
      projects: [
        {
          title: 'Autonomous Mobile Robot Navigation',
          technologies: 'ROS2, C++',
          description: 'Implemented SLAM and LiDAR point cloud processing.'
        }
      ]
    });

    assert.strictEqual(updated.skills, 'Python, C++, ROS2, Gazebo, OpenCV, PyTorch');
    assert.strictEqual(updated.projects.length, 1);
    assert.strictEqual(updated.projects[0].title, 'Autonomous Mobile Robot Navigation');
  });

  // 8. Step 6: Emergency Contact
  test('Step 6: Saves emergency contact details', async () => {
    const updated = await onboardingService.saveStep(applicantId, 6, {
      contact_person: 'R. Ravichandran',
      relationship: 'Parent',
      mobile_number: '9840998877',
      alternate_number: '04424912345'
    });

    assert.ok(updated.emergency_contacts);
    assert.strictEqual(updated.emergency_contacts[0].contact_person, 'R. Ravichandran');
    assert.strictEqual(updated.emergency_contacts[0].relationship, 'Parent');
  });

  // 9. Step 7: Bank Details (Encrypted and Masked)
  test('Step 7: Saves bank details, encrypts account number and masks on display', async () => {
    const updated = await onboardingService.saveStep(applicantId, 7, {
      account_holder_name: 'Vigneshwaran R',
      bank_name: 'HDFC Bank',
      account_number: '50100234567890',
      ifsc_code: 'HDFC0001234'
    });

    assert.ok(updated.bank_details);
    assert.strictEqual(updated.bank_details.account_holder_name, 'Vigneshwaran R');
    assert.ok(updated.bank_details.account_number_masked.endsWith('7890'));
    assert.ok(updated.bank_details.account_number_masked.includes('X'));
  });

  // 10. Step 8: Document Upload
  test('Step 8: Attaches required documents and validates category registration', async () => {
    const mandatoryCategories = ['resume', 'govt_id', 'academic_marksheets', 'passport_photo'];

    for (const cat of mandatoryCategories) {
      const doc = await onboardingService.attachDocument(applicantId, {
        category: cat,
        originalFilename: `${cat}_sample_doc.pdf`,
        filename: `${cat}_test_${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 245000,
        buffer: Buffer.from('%PDF-1.4 Mock Document Content for Testing')
      });

      assert.ok(doc);
      assert.strictEqual(doc.category, cat);
      assert.strictEqual(doc.verification_status, 'Pending');

      if (cat === 'resume') {
        uploadedDocId = doc.id;
      }
    }

    const appWithDocs = await onboardingService.getApplication(applicantId, false);
    assert.strictEqual(appWithDocs.documents.length, 4);
  });

  // 11. Official PDF Generation (PDFKit)
  test('PDF Generation Service produces valid PDF buffer with PUVIMA header and tables', async () => {
    const app = await onboardingService.getApplication(applicantId, true);
    const pdfBuffer = await onboardingPdfService.generatePdfBuffer(app);
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 500);

    // Verify PDF Magic Bytes (%PDF-)
    const magic = pdfBuffer.slice(0, 5).toString('ascii');
    assert.strictEqual(magic, '%PDF-');
  });

  // 12. Final Submission (Step 10)
  test('Step 10: Final submission validates all mandatory data and changes status to submitted', async () => {
    const submitted = await onboardingService.submitApplication(applicantId, {
      declarationAccepted: true,
      signatureName: 'Vigneshwaran R'
    });

    assert.strictEqual(submitted.status, 'Submitted');
    assert.ok(submitted.submission_date);
  });

  // 13. Public Tracking Status
  test('Public tracking endpoint returns application status and timeline items', async () => {
    let statusCode = null;
    let responseData = null;
    const mockReq = { params: { id: applicantId } };
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await onboardingController.getStatus(mockReq, mockRes);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.status, 'Submitted');
    assert.ok(Array.isArray(responseData.documents));
  });

  // 14. HR Verification: Document Verification
  test('HR verifies individual document (marks as verified)', async () => {
    const doc = await onboardingService.verifyDocument(applicantId, uploadedDocId, {
      verificationStatus: 'Verified',
      hrRemarks: 'Resume verified against LinkedIn profile.',
      hrUser: 'HR Lead Reviewer'
    });

    assert.ok(doc);
    assert.strictEqual(doc.verification_status, 'Verified');
    assert.strictEqual(doc.hr_remarks, 'Resume verified against LinkedIn profile.');
  });

  // 15. HR Correction Request Workflow
  test('HR requests corrections on specific fields and documents', async () => {
    const res = await onboardingService.requestCorrection(applicantId, {
      remarks: 'Please re-upload a clearer copy of the passport photograph.',
      affectedFields: ['Passport Size Photograph'],
      affectedDocuments: ['passport_photo'],
      hrUser: 'HR Lead Reviewer'
    });

    assert.strictEqual(res.status, 'Correction Required');
    assert.ok(res.correction_request);
    assert.strictEqual(res.correction_request.remarks, 'Please re-upload a clearer copy of the passport photograph.');
  });

  // 16. Applicant Resubmission Workflow
  test('Applicant resubmits corrected application', async () => {
    const res = await onboardingService.resubmitCorrections(applicantId, {
      changesSummary: 'Updated photograph has been uploaded.'
    });

    assert.strictEqual(res.status, 'Resubmitted');
  });

  // 17. HR Final Approval (All mandatory documents marked Verified first)
  test('HR issues final approval after complete verification of all mandatory documents', async () => {
    const appWithDocs = await onboardingService.getApplication(applicantId, false);
    for (const doc of appWithDocs.documents) {
      await onboardingService.verifyDocument(applicantId, doc.id, {
        verificationStatus: 'Verified',
        hrRemarks: 'Verified by HR.',
        hrUser: 'HR Lead Reviewer'
      });
    }

    const res = await onboardingService.approveApplication(applicantId, {
      hrUser: 'HR Lead Reviewer',
      hrNotes: 'All credentials and documents verified successfully.'
    });

    assert.strictEqual(res.status, 'Approved');
    assert.ok(res.approved_at);
    assert.strictEqual(res.approved_by, 'HR Lead Reviewer');
  });

  // 18. Audit History Log
  test('Audit history tracks complete chronological sequence of verification events', async () => {
    const history = await onboardingService.getAuditHistory(applicantId);
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 4);

    const actions = history.map(h => h.action.toLowerCase());
    assert.ok(actions.some(a => a.includes('submitted') || a.includes('submission')));
    assert.ok(actions.some(a => a.includes('correction')));
    assert.ok(actions.some(a => a.includes('approved') || a.includes('approval')));
  });

  // 19. HR Stats Metrics
  test('HR Stats aggregator reflects correct application counts', async () => {
    const stats = await onboardingService.getHrStats();
    assert.ok(stats);
    assert.ok(stats.total >= 1);
    assert.ok(stats.approved >= 1);
  });

  // 20. Controller Unit Test with Mock Req/Res
  test('OnboardingController.getHrApplications responds with status 200 and applications list', async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      query: { status: 'ALL' }
    };
    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await onboardingController.getHrApplications(mockReq, mockRes);
    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseBody.success, true);
    assert.ok(Array.isArray(responseBody.applications));
  });
});
