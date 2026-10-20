

const storeService = require('./store.service');
const { generateReferenceId, hashIp } = require('../utils/referenceId');
const emailService = require('./email.service');

class BookingService {
  async createBooking(data, clientIp = null) {
    const referenceId = generateReferenceId('REQ');
    const ipHash = hashIp(clientIp);

    await storeService.addBooking({
      reference_id: referenceId,
      name: data.name,
      email: data.email,
      company: data.company || null,
      topic: data.topic,
      preferred_date: data.preferredDate,
      preferred_time: data.preferredTime,
      meeting_format: data.meetingFormat || 'Virtual Video Session (Zoom / Meet)',
      message: data.message || null,
      ip_hash: ipHash
    });

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
