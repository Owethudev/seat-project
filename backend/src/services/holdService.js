const config = require('../config/config');
const eventStore = require('../storage/eventStore');
const { generateHoldCode } = require('../utils/holdCode');

function createServiceError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidSeatNumber(seatNumber) {
  return Number.isInteger(seatNumber) && seatNumber > 0;
}

function createUniqueHoldCode(event) {
  let holdCode = generateHoldCode();

  while (event.seats.some((seat) => seat.hold && seat.hold.code === holdCode)) {
    holdCode = generateHoldCode();
  }

  return holdCode;
}

function createHold({ email, seatNumber }) {
  if (!isValidEmail(email)) {
    throw createServiceError(
      'INVALID_EMAIL',
      'A valid email address is required.',
      400
    );
  }

  if (!isValidSeatNumber(seatNumber)) {
    throw createServiceError(
      'INVALID_SEAT_NUMBER',
      'Seat number must be a positive whole number.',
      400
    );
  }

  const event = eventStore.getEvent();
  const seat = event.seats.find((currentSeat) => currentSeat.number === seatNumber);

  if (!seat) {
    throw createServiceError(
      'SEAT_NOT_FOUND',
      `Seat ${seatNumber} does not exist.`,
      404
    );
  }

  if (seat.status !== 'available') {
    throw createServiceError(
      'SEAT_UNAVAILABLE',
      `Seat ${seatNumber} is not available.`,
      409
    );
  }

  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + config.holdExpirySeconds * 1000
  );
  const hold = {
    code: createUniqueHoldCode(event),
    email,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  seat.status = 'held';
  seat.hold = hold;
  eventStore.updateEvent(event);

  return {
    seatNumber: seat.number,
    ...hold
  };
}

module.exports = {
  createHold
};
