

const db = require('../config/database');
const { generateReferenceId, hashIp } = require('../utils/referenceId');
const emailService = require('./email.service');

class ContactService {
  
  async createEnquiry(data, clientIp = null) {
    const referenceId = generateReferenceId('CNT');
    const ipHash = hashIp(clientIp);

    const sql = `
      INSERT INTO contact_enquiries (
        reference_id, name, email, company, subject, message, status, ip_hash
      ) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
    `;

    const params = [
      referenceId,
      data.name,
      data.email,
      data.company || null,
      data.subject || null,
      data.message,
      ipHash
    ];

    try {
      await db.query(sql, params);
    } catch (err) {
      console.error('[ContactService] Database insertion failed:', err.message);
      const dbError = new Error('Unable to record enquiry due to a database service issue.');
      dbError.statusCode = 503;
      throw dbError;
    }

    
    emailService.notifyContactEnquiry({
      referenceId,
      name: data.name,
      email: data.email,
      subject: data.subject
    }).catch(err => console.error('[ContactService] Email notification error:', err.message));

    return {
      referenceId,
      status: 'received',
      message: 'Your inquiry has been received and logged. Our advisory team will respond within one business day.'
    };
  }
}

module.exports = new ContactService();
