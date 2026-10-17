

function errorHandler(err, req, res, next) {
  
  console.error('[SERVER ERROR]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    code: err.code
  });

  const statusCode = err.status || err.statusCode || 500;

  
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500
      ? 'An unexpected service error occurred. Our engineering operations team has been alerted.'
      : err.message
  });
}

module.exports = errorHandler;
