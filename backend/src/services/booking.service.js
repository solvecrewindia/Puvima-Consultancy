

const db = require('../config/database');
const { generateReferenceId, hashIp } = require('../utils/referenceId');
const emailService = require('./email.service');

class BookingService {
  
  async createBooking(data, clientIp = null) {
    const referenceId = generateReferenceId('REQ');
    const ipHash = hashIp(clientIp);

    const sql = `
      INSERT INTO consultation_bookings (
        reference_id, name, email, company, topic,
        preferred_date, preferred_time, meeting_format,
        message, status, ip_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)
    `;

    const params = [
      referenceId,
      data.name,
      data.email,
      data.company || null,
      data.topic,
      data.preferredDate,
      data.preferredTime,
      data.meetingFormat || 'Virtual Video Session (Zoom / Meet)',
      data.message || null,
      ipHash
    ];

    try {
      await db.query(sql, params);
    } catch (err) {
      console.error('[BookingService] Database insertion failed:', err.message);
      const dbError = new Error('Unable to record consultation request due to a database service issue.');
      dbError.statusCode = 503;
      throw dbError;
    }

    
    emailService.notifyBookingRequest({
      referenceId,
      name: data.name,
      email: data.email,
      topic: data.topic,
      date: data.preferredDate,
      time: data.preferredTime
    }).catch(err => console.error('[BookingService] Email notification error:', err.message));

    return {
      referenceId,
      status: 'pending_review',
      message: 'Your consultation appointment request has been securely recorded and is pending review by our advisory leads. An advisory coordinator will verify schedule availability and follow up via email with meeting coordinates.',
      details: {
        referenceId,
        topic: data.topic,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        meetingFormat: data.meetingFormat,
        status: 'pending_review'
      }
    };
  }
}

module.exports = new BookingService();
