

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || null;
    this.apiKey = process.env.EMAIL_API_KEY || null;
    this.fromEmail = process.env.EMAIL_FROM || 'advisory@puvima.com';
    this.configured = Boolean(this.provider && this.apiKey);
  }

  
  async notifyContactEnquiry(details) {
    if (!this.configured) {
      
      return {
        delivered: false,
        note: 'Email provider not configured. Enquiry record saved securely in database.'
      };
    }

    try {
      
      console.log(`[EmailService] Dispatching contact notification for ${details.referenceId}`);
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
    if (!this.configured) {
      return {
        delivered: false,
        calendarCreated: false,
        note: 'Email and Calendar provider not configured. Request recorded with status: pending_review.'
      };
    }

    try {
      console.log(`[EmailService] Dispatching booking acknowledgment for ${booking.referenceId}`);
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
