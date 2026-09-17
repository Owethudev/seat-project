const assert = require('node:assert/strict');
const test = require('node:test');

const eventStore = require('../src/storage/eventStore');
const { confirmHold, createHold } = require('../src/services/holdService');
const {
  joinWaitlist,
  removeFromWaitlist
} = require('../src/services/waitlistService');

test.afterEach(() => {
  eventStore.resetEvent();
});

function makeEventSoldOut() {
  for (const seat of eventStore.getEvent().seats) {
    seat.status = 'confirmed';
  }
}

test('a user can join the waitlist when all seats are unavailable', () => {
  makeEventSoldOut();

  const entry = joinWaitlist({ email: 'user@example.com' });

  assert.deepEqual(entry, {
    email: 'user@example.com',
    position: 1,
    status: 'waiting'
  });
});

test('a user cannot join the waitlist twice', () => {
  makeEventSoldOut();
  joinWaitlist({ email: 'user@example.com' });

  assert.throws(
    () => joinWaitlist({ email: 'user@example.com' }),
    { code: 'WAITLIST_ALREADY_JOINED', statusCode: 409 }
  );
});

test('a user with an active hold cannot join the waitlist', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  for (const seat of eventStore.getEvent().seats.slice(1)) {
    seat.status = 'confirmed';
  }

  assert.throws(
    () => joinWaitlist({ email: hold.email }),
    { code: 'ACTIVE_HOLD_EXISTS', statusCode: 409 }
  );
});

test('a user with a confirmed seat cannot join the waitlist', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  confirmHold({ email: hold.email, holdCode: hold.code });
  for (const seat of eventStore.getEvent().seats.slice(1)) {
    seat.status = 'confirmed';
  }

  assert.throws(
    () => joinWaitlist({ email: hold.email }),
    { code: 'CONFIRMED_SEAT_EXISTS', statusCode: 409 }
  );
});

test('a user can join after all seats become unavailable', () => {
  assert.throws(
    () => joinWaitlist({ email: 'user@example.com' }),
    { code: 'SEATS_AVAILABLE', statusCode: 409 }
  );

  makeEventSoldOut();
  assert.equal(joinWaitlist({ email: 'user@example.com' }).position, 1);
});

test('waitlist order is preserved', () => {
  makeEventSoldOut();

  joinWaitlist({ email: 'first@example.com' });
  joinWaitlist({ email: 'second@example.com' });
  joinWaitlist({ email: 'third@example.com' });

  assert.deepEqual(eventStore.getEvent().waitlist, [
    'first@example.com',
    'second@example.com',
    'third@example.com'
  ]);
});

test('a user can join again after being removed from the waitlist', () => {
  makeEventSoldOut();
  joinWaitlist({ email: 'user@example.com' });

  removeFromWaitlist('user@example.com');
  const newEntry = joinWaitlist({ email: 'user@example.com' });

  assert.equal(newEntry.position, 1);
  assert.deepEqual(eventStore.getEvent().waitlist, ['user@example.com']);
});
