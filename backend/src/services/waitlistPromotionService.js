const eventStore = require('../storage/eventStore');
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
