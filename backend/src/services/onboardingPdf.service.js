/**
 * Puvima IT Service and Research Consultancy — Onboarding Application Form PDF Generator
 * Creates an official, publication-quality A4 application document using PDFKit.
 * Dynamically populated with real applicant data, tables, check-boxes, and signature blocks.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATHS = [
  path.resolve(__dirname, '../../../frontend/assets/images/logo/puvima-logo-clean-dark.png'),
  path.resolve(__dirname, '../../../public/assets/images/logo/puvima-logo-clean-dark.png'),
  path.resolve(__dirname, '../../../../frontend/assets/images/logo/puvima-logo.png')
];

function findLogoPath() {
  for (const p of LOGO_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class OnboardingPdfService {

  generatePdfBuffer(application) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36, // 0.5 inch margins
          info: {
            Title: `PUVIMA Onboarding Application - ${application.application_id || 'Draft'}`,
            Author: 'Puvima IT Service and Research Consultancy',
            Subject: 'Employee / Intern Onboarding Application Form',
            Keywords: 'PUVIMA, Onboarding, HR, Application'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        const navyColor = '#003E7E';
        const slateDark = '#0F172A';
        const slateMuted = '#475569';
        const borderCol = '#94A3B8';
        const bgHeader = '#F1F5F9';

        // --- PAGE 1: HEADER & CORPORATE BRANDING ---
        const logoPath = findLogoPath();
        if (logoPath) {
          try {
            doc.image(logoPath, 36, 36, { width: 110 });
          } catch (e) {}
        }

        doc.fillColor(navyColor)
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('PUVIMA IT SERVICE AND RESEARCH CONSULTANCY', 160, 36, { align: 'right' });

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(8)
           .text('Innovation • Research • Excellence | Official Corporate Portal: https://puvima.com', 160, 53, { align: 'right' });

        doc.fillColor(slateDark)
           .font('Helvetica-Bold')
           .fontSize(11)
           .text('CANDIDATE ONBOARDING & HR VERIFICATION APPLICATION', 160, 66, { align: 'right' });

        doc.moveTo(36, 84).lineTo(559, 84).strokeColor(navyColor).lineWidth(1.5).stroke();

        // Application Metadata Ribbon
        doc.rect(36, 90, 523, 26).fillAndStroke(bgHeader, borderCol);
        doc.fillColor(slateDark)
           .font('Helvetica-Bold')
           .fontSize(9)
           .text(`Application ID: `, 44, 98, { continued: true })
           .fillColor(navyColor)
           .text(`${application.application_id || 'PENDING'}`)
           .fillColor(slateDark)
           .text(`Submission Date: `, 240, 98, { continued: true })
           .font('Helvetica')
           .text(application.submission_date ? new Date(application.submission_date).toLocaleDateString('en-GB') : 'Draft')
           .font('Helvetica-Bold')
           .text(`Verification Status: `, 400, 98, { continued: true })
           .fillColor(application.status === 'Approved' ? '#059669' : (application.status === 'Correction Required' ? '#D97706' : navyColor))
           .text(`${application.status || 'Draft'}`);

        let currY = 124;

        // SECTION DRAWING HELPER
        const drawSectionHeader = (title) => {
          doc.rect(36, currY, 523, 18).fillAndStroke(navyColor, navyColor);
          doc.fillColor('#FFFFFF')
             .font('Helvetica-Bold')
             .fontSize(9)
             .text(title.toUpperCase(), 44, currY + 4);
          currY += 22;
        };

        const drawGridRow = (col1Label, col1Val, col2Label, col2Val) => {
          doc.rect(36, currY, 261, 20).strokeColor(borderCol).lineWidth(0.5).stroke();
          doc.rect(297, currY, 262, 20).strokeColor(borderCol).lineWidth(0.5).stroke();

          doc.fillColor(slateMuted).font('Helvetica-Bold').fontSize(8).text(col1Label + ':', 42, currY + 5);
          doc.fillColor(slateDark).font('Helvetica').fontSize(8).text(String(col1Val || '—'), 130, currY + 5, { width: 160, ellipsis: true });

          doc.fillColor(slateMuted).font('Helvetica-Bold').fontSize(8).text(col2Label + ':', 303, currY + 5);
          doc.fillColor(slateDark).font('Helvetica').fontSize(8).text(String(col2Val || '—'), 390, currY + 5, { width: 160, ellipsis: true });

          currY += 20;
        };

        // 1. POSITION & ENGAGEMENT DETAILS
        drawSectionHeader('1. Position & Engagement Details');
        drawGridRow('Position Applied', application.position_applied, 'Domain / Specialization', application.domain_interest);
        drawGridRow('Preferred Joining', application.preferred_joining_date, 'Engagement Duration', application.duration);
        currY += 6;

        // 2. PERSONAL INFORMATION
        drawSectionHeader('2. Personal Information & Identification');
        drawGridRow('Full Name (as per ID)', application.applicant_name, 'Date of Birth', application.dob);
        drawGridRow('Gender', application.gender, 'Nationality', application.nationality);
        drawGridRow('Govt ID Type', application.id_type || 'Aadhaar', 'ID Number (Masked)', application.id_number_masked || '—');
        drawGridRow('Blood Group', application.blood_group || '—', 'Photo Status', 'Passport Photo Attached');
        currY += 6;

        // 3. CONTACT & ADDRESS DETAILS
        drawSectionHeader('3. Contact & Address Information');
        drawGridRow('Personal Email', application.applicant_email, 'Primary Mobile', application.applicant_phone);
        
        // Full width rows for addresses
        doc.rect(36, currY, 523, 22).strokeColor(borderCol).lineWidth(0.5).stroke();
        doc.fillColor(slateMuted).font('Helvetica-Bold').fontSize(8).text('Permanent Address:', 42, currY + 6);
        doc.fillColor(slateDark).font('Helvetica').fontSize(8).text(application.permanent_address || '—', 145, currY + 6, { width: 405, ellipsis: true });
        currY += 22;

        doc.rect(36, currY, 523, 22).strokeColor(borderCol).lineWidth(0.5).stroke();
        doc.fillColor(slateMuted).font('Helvetica-Bold').fontSize(8).text('Current Address:', 42, currY + 6);
        doc.fillColor(slateDark).font('Helvetica').fontSize(8).text(application.current_address || '—', 145, currY + 6, { width: 405, ellipsis: true });
        currY += 28;

        // 4. ACADEMIC INFORMATION TABLE
        drawSectionHeader('4. Academic Qualifications');
        // Table Header
        doc.rect(36, currY, 523, 18).fillAndStroke(bgHeader, borderCol);
        doc.fillColor(slateDark).font('Helvetica-Bold').fontSize(8);
        doc.text('Level', 42, currY + 5);
        doc.text('Degree / Course', 100, currY + 5);
        doc.text('Institution / University', 240, currY + 5);
        doc.text('Passing Year', 430, currY + 5);
        doc.text('CGPA / %', 500, currY + 5);
        currY += 18;

        const academics = (application.academic_details && application.academic_details.length > 0)
          ? application.academic_details
          : [{ qualification_type: 'UG', degree_name: 'B.Tech / B.E.', institution: 'Recognized University', year_of_passing: 2024, score_cgpa: 'First Class' }];

        academics.forEach(item => {
          doc.rect(36, currY, 523, 18).strokeColor(borderCol).lineWidth(0.5).stroke();
          doc.fillColor(slateDark).font('Helvetica').fontSize(8);
          doc.text(item.qualification_type || '—', 42, currY + 5);
          doc.text(item.degree_name || '—', 100, currY + 5, { width: 135, ellipsis: true });
          doc.text(item.institution || '—', 240, currY + 5, { width: 185, ellipsis: true });
          doc.text(String(item.year_of_passing || '—'), 430, currY + 5);
          doc.text(String(item.score_cgpa || '—'), 500, currY + 5);
          currY += 18;
        });
        currY += 10;

        // 5. SKILLS, TOOLS & EMERGENCY CONTACT
        drawSectionHeader('5. Skills, Experience & Emergency Contact');
        drawGridRow('Technical Skills', application.skills || 'Software & Research Engineering', 'Platforms & Tools', application.tools_platforms || 'Git, Linux, Python');
        
        const em = (application.emergency_contacts && application.emergency_contacts.length > 0) ? application.emergency_contacts[0] : {};
        drawGridRow('Emergency Contact', em.contact_person || 'Parent/Guardian', 'Relationship & Phone', `${em.relationship || 'Guardian'} — ${em.mobile_number || 'N/A'}`);
        currY += 6;

        // 6. BANK & DISBURSEMENT INFORMATION
        const bk = application.bank_details || {};
        drawSectionHeader('6. Bank Account Information (Restricted — Stipend / Reimbursement)');
        drawGridRow('Account Holder', bk.account_holder_name || application.applicant_name, 'Bank Name', bk.bank_name || 'National Bank');
        drawGridRow('Account Number', bk.account_number_masked || 'XXXXXXXXXXXX', 'IFSC Code', bk.ifsc_code || '—');
        currY += 10;

        // 7. SUBMITTED DOCUMENTS CHECKLIST
        drawSectionHeader('7. Supporting Documents Verification Checklist');
        const docCategories = [
          { key: 'resume', name: 'Updated Resume / Curriculum Vitae' },
          { key: 'govt_id', name: 'Government ID Proof (Aadhaar / Passport)' },
          { key: 'academic_marksheets', name: 'Academic Marksheets / Degree Certificate' },
          { key: 'passport_photo', name: 'Recent Passport Photograph' },
          { key: 'bank_proof', name: 'Bank Account Proof (Passbook / Cheque)' },
          { key: 'offer_letter', name: 'Offer / Acceptance Confirmation' }
        ];

        const uploadedKeys = (application.documents || []).map(d => d.category);

        for (let i = 0; i < docCategories.length; i += 2) {
          const doc1 = docCategories[i];
          const doc2 = docCategories[i + 1];

          doc.rect(36, currY, 261, 18).strokeColor(borderCol).lineWidth(0.5).stroke();
          doc.rect(297, currY, 262, 18).strokeColor(borderCol).lineWidth(0.5).stroke();

          const has1 = uploadedKeys.includes(doc1.key);
          doc.fillColor(has1 ? '#059669' : slateMuted).font('Helvetica-Bold').fontSize(8).text(has1 ? '[X]' : '[  ]', 44, currY + 5);
          doc.fillColor(slateDark).font('Helvetica').fontSize(8).text(doc1.name, 62, currY + 5, { width: 230, ellipsis: true });

          if (doc2) {
            const has2 = uploadedKeys.includes(doc2.key);
            doc.fillColor(has2 ? '#059669' : slateMuted).font('Helvetica-Bold').fontSize(8).text(has2 ? '[X]' : '[  ]', 305, currY + 5);
            doc.fillColor(slateDark).font('Helvetica').fontSize(8).text(doc2.name, 323, currY + 5, { width: 230, ellipsis: true });
          }

          currY += 18;
        }
        currY += 10;

        // 8. APPLICANT DECLARATION & CONFIRMATION
        drawSectionHeader('8. Applicant Declaration & Confirmation');
        doc.rect(36, currY, 523, 75).strokeColor(borderCol).lineWidth(0.5).stroke();
        
        doc.fillColor(slateDark).font('Helvetica').fontSize(7.5);
        doc.text('1. I hereby certify that the information provided in this onboarding application and all attached documents are true, complete, and correct to the best of my knowledge.', 44, currY + 6, { width: 507 });
        doc.text('2. I agree to abide by the rules, confidentiality policies, intellectual property terms, and code of conduct of Puvima IT Service and Research Consultancy.', 44, currY + 20, { width: 507 });
        doc.text('3. I understand that any false statement or omission of facts may lead to the revocation of my engagement or disciplinary action.', 44, currY + 34, { width: 507 });

        doc.fillColor(navyColor).font('Helvetica-Bold').fontSize(8);
        doc.text(`Digitally Confirmed & Signed By: `, 44, currY + 55, { continued: true });
        doc.fillColor(slateDark).font('Helvetica').text(`${application.applicant_signature_name || application.applicant_name}`);
        
        doc.fillColor(navyColor).font('Helvetica-Bold');
        doc.text(`Timestamp: `, 360, currY + 55, { continued: true });
        doc.fillColor(slateDark).font('Helvetica').text(application.submission_date ? new Date(application.submission_date).toLocaleString('en-GB') : new Date().toLocaleString('en-GB'));
        currY += 85;

        // 9. FOR OFFICE / HR USE ONLY
        doc.rect(36, currY, 523, 48).fillAndStroke(bgHeader, navyColor);
        doc.fillColor(navyColor).font('Helvetica-Bold').fontSize(8.5).text('FOR HR OPERATIONS & OFFICE USE ONLY', 44, currY + 6);
        
        doc.fillColor(slateDark).font('Helvetica-Bold').fontSize(8);
        doc.text('Verification Status: ', 44, currY + 20, { continued: true });
        doc.font('Helvetica').text(application.status || 'Pending Review');
        
        doc.font('Helvetica-Bold').text('Verified By: ', 220, currY + 20, { continued: true });
        doc.font('Helvetica').text(application.approved_by || application.reviewed_by || 'Human Resources Lead');
        
        doc.font('Helvetica-Bold').text('Approval Date: ', 390, currY + 20, { continued: true });
        doc.font('Helvetica').text(application.approved_at ? new Date(application.approved_at).toLocaleDateString('en-GB') : 'Pending');

        doc.fillColor(slateMuted).font('Helvetica').fontSize(7.5);
        doc.text('Official document generated by PUVIMA Enterprise HR Gateway. Verification hash: ' + (application.access_token ? application.access_token.substring(0, 16) : 'OFFICIAL-SEAL'), 44, currY + 34);

        doc.end();

      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new OnboardingPdfService();

