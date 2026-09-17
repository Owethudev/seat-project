const eventStore = require('../storage/eventStore');
const eventLogStore = require('../storage/eventLogStore');
const { getCurrentTime } = require('../utils/clock');
const { createAutomaticHold } = require('./holdRecordService');

function promoteAvailableSeats(getTime = getCurrentTime) {
  const event = eventStore.getEvent();
  let stateChanged = false;
  const promotedHolds = [];

  for (const seat of event.seats) {
    if (seat.status !== 'available') {
      continue;
    }

    while (event.waitlist.length > 0 && seat.status === 'available') {
      const email = event.waitlist.shift();
      const automaticHold = createAutomaticHold(event, seat, email, getTime());
      stateChanged = true;

      if (!automaticHold) {
        continue;
      }

      promotedHolds.push(automaticHold);
      eventLogStore.addEvent({
        type: 'HOLD_PLACED',
        seatNumber: automaticHold.seatNumber,
        email,
        holdCode: automaticHold.code,
        expiresAt: automaticHold.expiresAt,
        automatic: true
      }, getTime);
      eventLogStore.addEvent({
        type: 'WAITLIST_PROMOTED',
        seatNumber: automaticHold.seatNumber,
        email,
        holdCode: automaticHold.code
      }, getTime);
      console.log(
        `[WAITLIST] ${email} was automatically given seat ${seat.number}. Hold code: ${automaticHold.code}`
      );
    }
  }

  if (stateChanged) {
    eventStore.updateEvent(event);
  }

  return promotedHolds;
}

module.exports = {
  promoteAvailableSeats
};
