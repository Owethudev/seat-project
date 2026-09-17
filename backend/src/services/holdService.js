const config = require('../config/config');
const eventStore = require('../storage/eventStore');
const { getCurrentTime } = require('../utils/clock');
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

function isHoldExpired(hold, getTime) {
  return getTime() >= new Date(hold.expiresAt);
}

function expireHolds(getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  let expiredHoldCount = 0;

  for (const seat of event.seats) {
    if (seat.status === 'held' && seat.hold && isHoldExpired(seat.hold, getTime)) {
      seat.status = 'available';
      delete seat.hold;
      expiredHoldCount += 1;
    }
  }

  if (expiredHoldCount > 0) {
    eventStore.updateEvent(event);
  }

  return expiredHoldCount;
}

function getActiveHold(holdCode, getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  const seat = event.seats.find((currentSeat) => (
    currentSeat.hold && currentSeat.hold.code === holdCode
  ));

  if (!seat || !seat.hold) {
    throw createServiceError(
      'HOLD_NOT_FOUND',
      'The hold does not exist.',
      404
    );
  }

  if (isHoldExpired(seat.hold, getTime)) {
    expireHolds(getTime);
    throw createServiceError(
      'HOLD_EXPIRED',
      'The hold has expired.',
      409
    );
  }

  return {
    seatNumber: seat.number,
    ...seat.hold
  };
}

function createHold({ email, seatNumber }, getTime = getCurrentTime) {
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

  const createdAt = getTime();
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
  createHold,
  expireHolds,
  getActiveHold,
  isHoldExpired
};
