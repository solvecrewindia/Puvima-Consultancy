

const bookingService = require('../services/booking.service');

async function submitBooking(req, res, next) {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await bookingService.createBooking(req.sanitized, clientIp);

    res.status(201).json({
      success: true,
      referenceId: result.referenceId,
      status: result.status,
      message: result.message,
      details: result.details
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitBooking
};
