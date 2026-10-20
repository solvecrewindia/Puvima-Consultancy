

const storeService = require('./store.service');
const { generateReferenceId, hashIp } = require('../utils/referenceId');
const emailService = require('./email.service');

class ContactService {
  async createEnquiry(data, clientIp = null) {
    const referenceId = generateReferenceId('CNT');
    const ipHash = hashIp(clientIp);

    await storeService.addContact({
      reference_id: referenceId,
      name: data.name,
      email: data.email,
      company: data.company || null,
      subject: data.subject || null,
      message: data.message,
      ip_hash: ipHash
    });

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
