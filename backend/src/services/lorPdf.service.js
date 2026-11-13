/**
 * Puvima IT Service and Research Consultancy — Letter of Recommendation (LOR) PDF Generator
 * Produces an official publication-grade Letter of Recommendation document using PDFKit.
 * Dynamically populated with intern achievements, academic mentor endorsement, and corporate signatures.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATHS = [
  path.resolve(__dirname, '../../../frontend/assets/images/logo/puvima-logo-clean-dark.png'),
  path.resolve(__dirname, '../../../public/assets/images/logo/puvima-logo-clean-dark.png'),
  path.resolve(__dirname, '../../../frontend/company/assets/logo/puvima-emblem.png'),
  path.resolve(__dirname, '../../../public/company/assets/logo/puvima-emblem.png')
];

function findLogoPath() {
  for (const p of LOGO_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class LorPdfService {
  generatePdfBuffer(lor) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `PUVIMA Letter of Recommendation - ${lor.lor_request_id || 'Document'}`,
            Author: 'Puvima IT Service and Research Consultancy',
            Subject: `Letter of Recommendation for ${lor.intern_name}`,
            Keywords: 'PUVIMA, LOR, Recommendation, Research, Intern'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        const navyColor = '#001D35';
        const royalBlue = '#0B57D0';
        const goldColor = '#D97706';
        const slateDark = '#0F172A';
        const slateMuted = '#475569';
        const borderCol = '#CBD5E1';
        const bgSubtle = '#F8FAFC';

        // --- HEADER ---
        const logoPath = findLogoPath();
        if (logoPath) {
          try {
            doc.image(logoPath, 40, 40, { width: 50, height: 50 });
          } catch (e) {}
        }

        doc.fillColor(navyColor)
           .font('Helvetica-Bold')
           .fontSize(16)
           .text('PUVIMA IT SERVICE AND RESEARCH CONSULTANCY', 100, 42);

        doc.fillColor(goldColor)
           .font('Helvetica-Bold')
           .fontSize(9)
           .text('INNOVATION • ADVANCED ENGINEERING • SCIENTIFIC RESEARCH', 100, 62);

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(8)
           .text('CIN / Reg: PUVIMA-TECH-RES-2026 | Web: www.puvima.com | Mail: contact@puvima.com', 100, 75);

        // Horizontal Rule
        doc.strokeColor(navyColor)
           .lineWidth(1.5)
           .moveTo(40, 96)
           .lineTo(555, 96)
           .stroke();

        doc.strokeColor(goldColor)
           .lineWidth(1)
           .moveTo(40, 99)
           .lineTo(555, 99)
           .stroke();

        // Document Meta Bar
        doc.fillColor(slateDark)
           .font('Helvetica-Bold')
           .fontSize(9)
           .text(`REF ID: ${lor.lor_request_id || 'PV-LOR-2026'}`, 40, 112);

        const issueDate = lor.hr_verified_at 
          ? new Date(lor.hr_verified_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(9)
           .text(`Date of Issue: ${issueDate}`, 380, 112, { align: 'right', width: 175 });

        // Title
        doc.fillColor(navyColor)
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('OFFICIAL LETTER OF RECOMMENDATION', 40, 140, { align: 'center', width: 515 });

        doc.fillColor(royalBlue)
           .font('Helvetica-Oblique')
           .fontSize(9)
           .text('Academic & Professional Research Fellowship Endorsement', 40, 158, { align: 'center', width: 515 });

        // Salutation
        doc.fillColor(slateDark)
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('TO WHOMSOEVER IT MAY CONCERN,', 40, 185);

        // Body Paragraph 1
        const internName = lor.intern_name || 'The Candidate';
        const domain = lor.domain_specialization || 'Software & Research Engineering';
        const college = lor.college_university || 'University';
        const startStr = lor.internship_start_date || 'January 2026';
        const endStr = lor.internship_end_date || 'Present';

        const para1 = `It is with immense pleasure and high professional confidence that we provide this official Letter of Recommendation for ${internName}, a student of ${college}, who has successfully undertaken and served an intensive research internship in ${domain} at Puvima IT Service and Research Consultancy from ${startStr} to ${endStr}.`;

        doc.fillColor(slateDark)
           .font('Helvetica')
           .fontSize(9.5)
           .text(para1, 40, 205, { align: 'justify', lineGap: 3.5 });

        // Body Paragraph 2 (Project & Technical Deliverables)
        const projectTitle = lor.project_title || 'Advanced Initiative';
        const deliverables = lor.project_deliverables || 'Design, engineering analysis, and implementation of core modules.';

        const para2 = `During the tenure of the fellowship, ${internName} demonstrated exemplary analytical rigor, software architectural competence, and dedication. As part of their core assignment, they led work on "${projectTitle}", delivering: ${deliverables}. They demonstrated an ability to synthesize complex technological concepts into functional solutions, collaborate effectively within cross-disciplinary teams, and maintain adherence to rigorous engineering standards.`;

        doc.text(para2, 40, 268, { align: 'justify', lineGap: 3.5 });

        // Academic Mentor Endorsement Box
        const boxTop = 350;
        doc.rect(40, boxTop, 515, 125)
           .fillAndStroke(bgSubtle, borderCol);

        doc.fillColor(navyColor)
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('VERIFIED ACADEMIC FACULTY MENTOR ENDORSEMENT', 55, boxTop + 12);

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(8.5)
           .text('This candidate was nominated and independently confirmed by their university academic supervisor:', 55, boxTop + 27);

        doc.fillColor(slateDark)
           .font('Helvetica-Bold')
           .fontSize(9)
           .text('Faculty Mentor:', 55, boxTop + 45)
           .font('Helvetica')
           .text(`${lor.professor_name || '-'} (${lor.professor_designation || 'Professor'})`, 150, boxTop + 45);

        doc.font('Helvetica-Bold')
           .text('Institution / Dept:', 55, boxTop + 60)
           .font('Helvetica')
           .text(`${lor.professor_institution || '-'} — ${lor.professor_department || 'Engineering'}`, 150, boxTop + 60);

        doc.font('Helvetica-Bold')
           .text('Official Contact:', 55, boxTop + 75)
           .font('Helvetica')
           .text(`${lor.professor_email || '-'} | Phone: ${lor.professor_phone || '-'}`, 150, boxTop + 75);

        const profConfirmDate = lor.professor_confirmed_at 
          ? new Date(lor.professor_confirmed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : 'Verified Online';

        const ratingText = lor.professor_rating ? `Assessment: ${lor.professor_rating}` : 'Endorsement: Confirmed';

        doc.fillColor(royalBlue)
           .font('Helvetica-Bold')
           .fontSize(8.5)
           .text(`STATUS: ${ratingText.toUpperCase()} • CONFIRMED ON ${profConfirmDate.toUpperCase()}`, 55, boxTop + 95);

        if (lor.professor_endorsement_remarks) {
          doc.fillColor(slateMuted)
             .font('Helvetica-Oblique')
             .fontSize(8)
             .text(`Remarks: "${lor.professor_endorsement_remarks}"`, 55, boxTop + 108, { width: 485, height: 14, ellipsis: true });
        }

        // Conclusion Paragraph
        const para3 = `Based on their demonstrated performance, technical proficiency, and moral integrity throughout their engagement with Puvima IT Service and Research Consultancy, we endorse ${internName} wholeheartedly for higher academic pursuits, industrial opportunities, or research fellowships. We wish them exemplary success in all their future endeavors.`;

        doc.fillColor(slateDark)
           .font('Helvetica')
           .fontSize(9.5)
           .text(para3, 40, 495, { align: 'justify', lineGap: 3.5 });

        // Signature Section
        const sigTop = 575;

        doc.fillColor(navyColor)
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('For PUVIMA IT SERVICE AND RESEARCH CONSULTANCY', 40, sigTop);

        doc.fillColor(slateDark)
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('Dr. P. Sundaram, Ph.D.', 40, sigTop + 45);

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(8.5)
           .text('Principal Consultant & Director of Research', 40, sigTop + 58);

        doc.text('Puvima IT Service and Research Consultancy', 40, sigTop + 70);

        // Seal / Verification Box on Right
        doc.rect(370, sigTop - 5, 185, 88)
           .strokeColor(borderCol)
           .lineWidth(1)
           .stroke();

        doc.fillColor(goldColor)
           .font('Helvetica-Bold')
           .fontSize(8.5)
           .text('OFFICIAL VERIFIED DOCUMENT', 380, sigTop + 6, { align: 'center', width: 165 });

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(7.5)
           .text(`Doc Ref: ${lor.lor_request_id}`, 380, sigTop + 20, { align: 'center', width: 165 });

        doc.text(`Candidate: ${lor.intern_email}`, 380, sigTop + 32, { align: 'center', width: 165 });

        doc.fillColor(royalBlue)
           .font('Helvetica-Bold')
           .text('Endorsed & Cleared by HR', 380, sigTop + 46, { align: 'center', width: 165 });

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(7)
           .text('To authenticate this LOR, visit www.puvima.com or write to contact@puvima.com', 380, sigTop + 62, { align: 'center', width: 165 });

        // Footer
        doc.strokeColor(borderCol)
           .lineWidth(0.5)
           .moveTo(40, 750)
           .lineTo(555, 750)
           .stroke();

        doc.fillColor(slateMuted)
           .font('Helvetica')
           .fontSize(7.5)
           .text('Puvima IT Service and Research Consultancy • Corporate Headquarters: Coimbatore & Chennai, Tamil Nadu, India • www.puvima.com', 40, 758, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new LorPdfService();

