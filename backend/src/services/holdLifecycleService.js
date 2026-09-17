const config = require('../config/config');
const eventStore = require('../storage/eventStore');
const eventLogStore = require('../storage/eventLogStore');
const { getCurrentTime } = require('../utils/clock');
const { createServiceError } = require('./serviceError');
const { promoteAvailableSeats } = require('./waitlistPromotionService');

function isHoldExpired(hold, getTime) {
  return getTime() >= new Date(hold.expiresAt);
}

function expireHolds(getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  let expiredHoldCount = 0;

  for (const seat of event.seats) {
    if (seat.status === 'held' && seat.hold && isHoldExpired(seat.hold, getTime)) {
      const expiredHold = seat.hold;
      seat.status = 'available';
      delete seat.hold;
      expiredHoldCount += 1;
      eventLogStore.addEvent({
        type: 'HOLD_EXPIRED',
        seatNumber: seat.number,
        email: expiredHold.email,
        holdCode: expiredHold.code
      }, getTime);
    }
  }

  if (expiredHoldCount > 0) {
    eventStore.updateEvent(event);
    promoteAvailableSeats(getTime);
  }

  return expiredHoldCount;
}

function findHoldSeat(event, holdCode) {
  return event.seats.find((currentSeat) => (
    currentSeat.hold && currentSeat.hold.code === holdCode
  ));
}

function validateHoldOwner(seat, email) {
  if (seat.hold.email !== email) {
    throw createServiceError(
      'HOLD_EMAIL_MISMATCH',
      'The email does not match the hold.',
      403
    );
  }
}

function getActiveHold(holdCode, getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  const seat = findHoldSeat(event, holdCode);

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

function getConfirmationResult(seat) {
  return {
    seatNumber: seat.number,
    holdCode: seat.hold.code,
    email: seat.hold.email,
    status: 'confirmed'
  };
}

function confirmHold({ email, holdCode }, getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  const seat = findHoldSeat(event, holdCode);

  if (!seat || !seat.hold) {
    throw createServiceError(
      'HOLD_NOT_FOUND',
      'The hold does not exist.',
      404
    );
  }

  validateHoldOwner(seat, email);

  if (seat.status === 'confirmed') {
    return getConfirmationResult(seat);
  }

  if (seat.status !== 'held') {
    throw createServiceError(
      'HOLD_NOT_ACTIVE',
      'The hold is no longer active.',
      409
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

  seat.status = 'confirmed';
  eventStore.updateEvent(event);
  eventLogStore.addEvent({
    type: 'HOLD_CONFIRMED',
    seatNumber: seat.number,
    email: seat.hold.email,
    holdCode: seat.hold.code
  }, getTime);

  return getConfirmationResult(seat);
}

function extendHold({ email, holdCode }, getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  const seat = findHoldSeat(event, holdCode);

  if (!seat || !seat.hold) {
    throw createServiceError(
      'HOLD_NOT_FOUND',
      'The hold does not exist.',
      404
    );
  }

  validateHoldOwner(seat, email);

  if (seat.status === 'confirmed') {
    throw createServiceError(
      'HOLD_CONFIRMED',
      'A confirmed seat cannot be extended.',
      409
    );
  }

  if (seat.status !== 'held') {
    throw createServiceError(
      'HOLD_NOT_ACTIVE',
      'The hold is no longer active.',
      409
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

  if (seat.hold.extensionCount >= config.maxExtensionsPerHold) {
    throw createServiceError(
      'MAX_EXTENSIONS_EXCEEDED',
      `A hold cannot be extended more than ${config.maxExtensionsPerHold} times.`,
      409
    );
  }

  const currentTime = getTime();
  const newExpiresAt = new Date(
    currentTime.getTime() + config.holdExpirySeconds * 1000
  );

  seat.hold.expiresAt = newExpiresAt.toISOString();
  seat.hold.extensionCount += 1;
  eventStore.updateEvent(event);
  eventLogStore.addEvent({
    type: 'HOLD_EXTENDED',
    seatNumber: seat.number,
    email: seat.hold.email,
    holdCode: seat.hold.code,
    expiresAt: seat.hold.expiresAt,
    extensionCount: seat.hold.extensionCount
  }, getTime);

  return {
    seatNumber: seat.number,
    ...seat.hold
  };
}

function releaseHold({ email, holdCode }, getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  const seat = findHoldSeat(event, holdCode);

  if (!seat || !seat.hold) {
    throw createServiceError(
      'HOLD_NOT_FOUND',
      'The hold does not exist.',
      404
    );
  }

  validateHoldOwner(seat, email);

  if (seat.status === 'held' && isHoldExpired(seat.hold, getTime)) {
    expireHolds(getTime);
    throw createServiceError(
      'HOLD_EXPIRED',
      'The hold has expired.',
      409
    );
  }

  if (seat.status !== 'held' && seat.status !== 'confirmed') {
    throw createServiceError(
      'HOLD_NOT_ACTIVE',
      'The hold is no longer active.',
      409
    );
  }

  const releasedHold = {
    seatNumber: seat.number,
    holdCode: seat.hold.code,
    email: seat.hold.email,
    status: 'released'
  };

  seat.status = 'available';
  delete seat.hold;
  eventStore.updateEvent(event);
  eventLogStore.addEvent({
    type: 'HOLD_RELEASED',
    seatNumber: releasedHold.seatNumber,
    email: releasedHold.email,
    holdCode: releasedHold.holdCode
  }, getTime);
  promoteAvailableSeats(getTime);

  return releasedHold;
}

module.exports = {
  confirmHold,
  expireHolds,
  extendHold,
  getActiveHold,
  isHoldExpired,
  releaseHold
};
