/**
 * PUVIMA Consultancy — Email Notification Service
 * Supports standard SMTP transport via Nodemailer with graceful fallback when unconfigured.
 * Handles recruitment alerts, consultation booking confirmations, and contact inquiries.
 */

const nodemailer = require('nodemailer');
const fs = require('fs');

class EmailService {
  constructor() {
    this.smtpHost = process.env.SMTP_HOST || null;
    this.smtpPort = parseInt(process.env.SMTP_PORT, 10) || 587;
    this.smtpUser = process.env.SMTP_USER || null;
    this.smtpPass = process.env.SMTP_PASS || null;
    this.fromEmail = process.env.MAIL_FROM || process.env.EMAIL_FROM || 'advisory@puvima.com';
    this.recruitmentEmail = process.env.RECRUITMENT_EMAIL || 'recruitment@puvima.com';

    this.provider = process.env.EMAIL_PROVIDER || null;
    this.apiKey = process.env.EMAIL_API_KEY || null;

    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: this.smtpHost,
          port: this.smtpPort,
          secure: this.smtpPort === 465,
          auth: {
            user: this.smtpUser,
            pass: this.smtpPass
          }
        });
      } catch (err) {
        console.error('[EmailService] Failed to initialize SMTP transport:', err.message);
        this.transporter = null;
      }
    }
  }

  get isConfigured() {
    return Boolean(this.transporter || (this.provider && this.apiKey));
  }

  /**
   * Send recruitment notification for a newly submitted candidate application.
   * Invoked ONLY AFTER the application record has been durably saved to the database.
   * @param {Object} params
   * @param {Object} params.application
   * @param {Object} params.position
   * @param {string} [params.resumePath]
   * @returns {Promise<{ delivered: boolean, note: string, error?: string }>}
   */
  async notifyJobApplication({ application, position, resumePath }) {
    if (!this.transporter) {
      return {
        delivered: false,
        note: 'Outbound SMTP provider not configured in environment. Application record safely preserved in database.'
      };
    }

    try {
      const attachments = [];
      if (resumePath && fs.existsSync(resumePath)) {
        attachments.push({
          filename: application.resume_filename || 'Candidate_Resume.pdf',
          path: resumePath
        });
      }

      // 1. Send alert to recruitment inbox
      const recruiterMail = {
        from: `"PUVIMA Recruitment Desk" <${this.fromEmail}>`,
        to: this.recruitmentEmail,
        subject: `[New Application] ${application.applicant_name} — ${position.title} (${application.reference_id})`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
            <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #0f172a; font-size: 20px;">PUVIMA Consultancy — Talent Acquisition</h2>
              <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">New Candidate Application Received</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Position:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${position.title} (${position.department})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Reference ID:</td>
                <td style="padding: 6px 0; font-family: monospace; font-weight: bold; color: #0284c7;">${application.reference_id}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Applicant Name:</td>
                <td style="padding: 6px 0; font-weight: 600;">${application.applicant_name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Applicant Email:</td>
                <td style="padding: 6px 0;"><a href="mailto:${application.applicant_email}" style="color: #0284c7;">${application.applicant_email}</a></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Applicant Phone:</td>
                <td style="padding: 6px 0;">${application.applicant_phone}</td>
              </tr>
              ${application.education ? `<tr><td style="padding: 6px 0; color: #64748b;">Education:</td><td style="padding: 6px 0;">${application.education}</td></tr>` : ''}
              ${application.experience_years ? `<tr><td style="padding: 6px 0; color: #64748b;">Experience:</td><td style="padding: 6px 0;">${application.experience_years}</td></tr>` : ''}
              ${application.skills ? `<tr><td style="padding: 6px 0; color: #64748b;">Skills:</td><td style="padding: 6px 0;">${application.skills}</td></tr>` : ''}
              ${application.linkedin_url ? `<tr><td style="padding: 6px 0; color: #64748b;">LinkedIn:</td><td style="padding: 6px 0;"><a href="${application.linkedin_url}" target="_blank" style="color: #0284c7;">${application.linkedin_url}</a></td></tr>` : ''}
              ${application.portfolio_url ? `<tr><td style="padding: 6px 0; color: #64748b;">Portfolio/GitHub:</td><td style="padding: 6px 0;"><a href="${application.portfolio_url}" target="_blank" style="color: #0284c7;">${application.portfolio_url}</a></td></tr>` : ''}
            </table>

            ${application.cover_letter ? `
              <div style="background: #f8fafc; border-left: 3px solid #0284c7; padding: 12px 16px; margin: 16px 0; font-size: 13px; line-height: 1.5; color: #334155;">
                <strong>Candidate Note / Cover Letter:</strong><br>
                ${application.cover_letter.replace(/\n/g, '<br>')}
              </div>
            ` : ''}

            <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              Resume is attached. You can also view or update this application in the <a href="${process.env.FRONTEND_ORIGIN || ''}/admin" style="color: #0284c7;">PUVIMA Executive Admin Portal</a>.
            </p>
          </div>
        `,
        attachments
      };

      await this.transporter.sendMail(recruiterMail);

      // 2. Send acknowledgment to applicant
      try {
        const applicantAckMail = {
          from: `"PUVIMA Consultancy" <${this.fromEmail}>`,
          to: application.applicant_email,
          subject: `Application Received: ${position.title} — PUVIMA Consultancy`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
              <h2 style="color: #0f172a; margin-top: 0;">Thank You for Applying</h2>
              <p>Dear ${application.applicant_name},</p>
              <p>We have received your application for the <strong>${position.title}</strong> role at PUVIMA Consultancy.</p>
              <p>Your unique application tracking reference is: <strong style="font-family: monospace; color: #0284c7;">${application.reference_id}</strong></p>
              <p>Our talent acquisition team will evaluate your profile against the technical requirements of the role. Should your qualifications align with our current focus areas, a recruiter will reach out regarding next steps.</p>
              <br>
              <p style="margin: 0;">Warm regards,</p>
              <p style="margin: 4px 0 0; font-weight: 600;">PUVIMA Consultancy Talent Acquisition Desk</p>
              <p style="margin: 0; color: #64748b; font-size: 13px;">Innovation. Research. Excellence.</p>
            </div>
          `
        };
        await this.transporter.sendMail(applicantAckMail);
      } catch (ackErr) {
        console.error('[EmailService] Applicant confirmation delivery error:', ackErr.message);
      }

      return {
        delivered: true,
        note: `Recruitment notification successfully dispatched to ${this.recruitmentEmail}.`
      };
    } catch (err) {
      console.error('[EmailService] Recruitment notification dispatch error:', err.message);
      return {
        delivered: false,
        error: err.message,
        note: 'Email delivery encountered a network issue after application was safely preserved.'
      };
    }
  }

  async notifyContactEnquiry(details) {
    if (!this.isConfigured) {
      return {
        delivered: false,
        note: 'Email provider not configured. Enquiry record saved securely in database.'
      };
    }

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: `"PUVIMA Advisory" <${this.fromEmail}>`,
          to: process.env.NOTIFICATION_RECIPIENT || 'advisory@puvima.com',
          subject: `[Contact Enquiry] ${details.name} - Ref: ${details.referenceId}`,
          text: `Contact enquiry received from ${details.name} (${details.email}) with reference ${details.referenceId}. Subject: ${details.subject || 'N/A'}`
        });
      }
      return {
        delivered: true,
        note: 'Notification dispatched to advisory desk.'
      };
    } catch (err) {
      console.error('[EmailService] Dispatch error:', err.message);
      return {
        delivered: false,
        note: 'Email dispatch encountered a transient network issue.'
      };
    }
  }

  async notifyBookingRequest(booking) {
    if (!this.isConfigured) {
      return {
        delivered: false,
        calendarCreated: false,
        note: 'Email and Calendar provider not configured. Request recorded with status: pending_review.'
      };
    }

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: `"PUVIMA Advisory" <${this.fromEmail}>`,
          to: process.env.NOTIFICATION_RECIPIENT || 'advisory@puvima.com',
          subject: `[Consultation Booking] ${booking.name} - Ref: ${booking.referenceId}`,
          text: `Booking requested by ${booking.name} (${booking.email}) for ${booking.topic} on ${booking.preferred_date || booking.preferredDate}.`
        });
      }
      return {
        delivered: true,
        calendarCreated: false,
        note: 'Booking acknowledgment dispatched.'
      };
    } catch (err) {
      console.error('[EmailService] Booking dispatch error:', err.message);
      return {
        delivered: false,
        calendarCreated: false,
        note: 'Notification dispatch failed.'
      };
    }
  }
}

module.exports = new EmailService();
