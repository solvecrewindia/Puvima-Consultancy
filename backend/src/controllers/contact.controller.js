

const contactService = require('../services/contact.service');

async function submitContact(req, res, next) {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await contactService.createEnquiry(req.sanitized, clientIp);

    res.status(201).json({
      success: true,
      referenceId: result.referenceId,
      status: result.status,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitContact
};
