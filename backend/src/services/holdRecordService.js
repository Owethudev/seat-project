const config = require('../config/config');
const { generateHoldCode } = require('../utils/holdCode');

function createUniqueHoldCode(event) {
  let holdCode = generateHoldCode();

  while (event.usedHoldCodes.includes(holdCode)) {
    holdCode = generateHoldCode();
  }

  return holdCode;
}

function getActiveHoldCount(event, email) {
  return event.seats.filter((seat) => (
    seat.status === 'held' && seat.hold && seat.hold.email === email
  )).length;
}

function createHoldRecord(event, seat, email, createdAt, recordHistory) {
  const expiresAt = new Date(
    createdAt.getTime() + config.holdExpirySeconds * 1000
  );
  const hold = {
    code: createUniqueHoldCode(event),
    email,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    extensionCount: 0
  };

  seat.status = 'held';
  seat.hold = hold;
  event.usedHoldCodes.push(hold.code);

  if (recordHistory) {
    event.holdHistory.push({
      code: hold.code,
      email: hold.email,
      createdAt: hold.createdAt
    });
  }

  return {
    seatNumber: seat.number,
    ...hold
  };
}

function createAutomaticHold(event, seat, email, createdAt) {
  if (getActiveHoldCount(event, email) >= config.maxActiveHoldsPerUser) {
    return null;
  }

  return createHoldRecord(event, seat, email, createdAt, false);
}

module.exports = {
  createAutomaticHold,
  createHoldRecord,
  getActiveHoldCount
};
