const config = require('../config/config');
const eventStore = require('../storage/eventStore');
const { getCurrentTime } = require('../utils/clock');
const { isValidEmail } = require('../utils/validation');
const { createServiceError } = require('./serviceError');
const {
  createHoldRecord,
  getActiveHoldCount
} = require('./holdRecordService');
const { expireHolds } = require('./holdLifecycleService');

function isValidSeatNumber(seatNumber) {
  return Number.isInteger(seatNumber) && seatNumber > 0;
}

function getRecentHoldHistory(event, email, currentTime) {
  const windowStart = currentTime.getTime() - (60 * 60 * 1000);
  const recentHoldHistory = event.holdHistory.filter((holdRecord) => {
    const createdAt = Date.parse(holdRecord.createdAt);
    return createdAt > windowStart && createdAt <= currentTime.getTime();
  });

  return recentHoldHistory.filter((holdRecord) => holdRecord.email === email);
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
  expireHolds(getTime);
  const currentTime = getTime();
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

  if (getActiveHoldCount(event, email) >= config.maxActiveHoldsPerUser) {
    throw createServiceError(
      'MAX_ACTIVE_HOLDS_EXCEEDED',
      `A user cannot have more than ${config.maxActiveHoldsPerUser} active holds.`,
      409
    );
  }

  if (getRecentHoldHistory(event, email, currentTime).length >= config.maxHoldsPerHourPerUser) {
    throw createServiceError(
      'HOLD_RATE_LIMIT_EXCEEDED',
      `A user cannot create more than ${config.maxHoldsPerHourPerUser} holds within one hour.`,
      429
    );
  }

  const hold = createHoldRecord(event, seat, email, currentTime, true);
  eventStore.updateEvent(event);

  return hold;
}

module.exports = {
  createHold
};
