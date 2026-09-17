const eventStore = require('../storage/eventStore');
const eventLogStore = require('../storage/eventLogStore');
const { getCurrentTime } = require('../utils/clock');
const { isValidEmail } = require('../utils/validation');
const { expireHolds } = require('./holdLifecycleService');
const { createServiceError } = require('./serviceError');
const { promoteAvailableSeats } = require('./waitlistPromotionService');

function hasActiveHold(event, email) {
  return event.seats.some((seat) => (
    seat.status === 'held' && seat.hold && seat.hold.email === email
  ));
}

function hasConfirmedSeat(event, email) {
  return event.seats.some((seat) => (
    seat.status === 'confirmed' && seat.hold && seat.hold.email === email
  ));
}

function areAllSeatsUnavailable(event) {
  return event.seats.every((seat) => (
    seat.status === 'held' || seat.status === 'confirmed'
  ));
}

function joinWaitlist({ email }, getTime = getCurrentTime) {
  if (!isValidEmail(email)) {
    throw createServiceError(
      'INVALID_EMAIL',
      'A valid email address is required.',
      400
    );
  }

  const event = eventStore.getEvent();
  expireHolds(getTime);

  if (event.waitlist.includes(email)) {
    throw createServiceError(
      'WAITLIST_ALREADY_JOINED',
      'The user is already on the waitlist.',
      409
    );
  }

  if (hasActiveHold(event, email)) {
    throw createServiceError(
      'ACTIVE_HOLD_EXISTS',
      'A user with an active hold cannot join the waitlist.',
      409
    );
  }

  if (hasConfirmedSeat(event, email)) {
    throw createServiceError(
      'CONFIRMED_SEAT_EXISTS',
      'A user with a confirmed seat cannot join the waitlist.',
      409
    );
  }

  if (!areAllSeatsUnavailable(event)) {
    throw createServiceError(
      'SEATS_AVAILABLE',
      'The waitlist is only available when all seats are unavailable.',
      409
    );
  }

  event.waitlist.push(email);
  eventStore.updateEvent(event);
  eventLogStore.addEvent({
    type: 'WAITLIST_JOINED',
    email
  }, getTime);

  return {
    email,
    position: event.waitlist.length,
    status: 'waiting'
  };
}

function removeFromWaitlist(email) {
  const event = eventStore.getEvent();
  const waitlistIndex = event.waitlist.indexOf(email);

  if (waitlistIndex === -1) {
    throw createServiceError(
      'WAITLIST_ENTRY_NOT_FOUND',
      'The user is not on the waitlist.',
      404
    );
  }

  event.waitlist.splice(waitlistIndex, 1);
  eventStore.updateEvent(event);
  eventLogStore.addEvent({
    type: 'WAITLIST_REMOVED',
    email
  });

  return { email };
}

module.exports = {
  joinWaitlist,
  promoteAvailableSeats,
  removeFromWaitlist
};
