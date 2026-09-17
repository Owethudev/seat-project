function sendError(response, error) {
  response.status(error.statusCode || 500).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred.'
    }
  });
}

function createRequestError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function requireEmail(body) {
  if (!body.email) {
    throw createRequestError('EMAIL_REQUIRED', 'Email is required.');
  }
}

function requireSeatNumber(body) {
  if (!Number.isInteger(body.seatNumber)) {
    throw createRequestError(
      'INVALID_SEAT_NUMBER',
      'Seat number must be a whole number.'
    );
  }
}

function requireHoldCode(body) {
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(body.holdCode || '')) {
    throw createRequestError(
      'INVALID_HOLD_CODE',
      'Hold code must contain six allowed uppercase letters or digits.'
    );
  }
}

module.exports = {
  createRequestError,
  requireEmail,
  requireHoldCode,
  requireSeatNumber,
  sendError
};
