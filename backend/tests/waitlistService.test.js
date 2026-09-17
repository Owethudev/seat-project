const assert = require('node:assert/strict');
const test = require('node:test');

const config = require('../src/config/config');
const eventStore = require('../src/storage/eventStore');
const {
  confirmHold,
  createHold,
  expireHolds,
  releaseHold
} = require('../src/services/holdService');
const {
  joinWaitlist,
  removeFromWaitlist
} = require('../src/services/waitlistService');
const { resetState } = require('./testState');

test.afterEach(() => {
  resetState();
});

function makeEventSoldOut() {
  for (const seat of eventStore.getEvent().seats) {
    seat.status = 'confirmed';
  }
}

function createSoldOutEventWithOwner(getTime) {
  const ownerHold = createHold(
    { email: 'owner@example.com', seatNumber: 1 },
    getTime
  );

  for (const seat of eventStore.getEvent().seats.slice(1)) {
    seat.status = 'confirmed';
  }

  return ownerHold;
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

test('releasing a seat promotes the first waitlisted user', () => {
  const ownerHold = createSoldOutEventWithOwner();
  joinWaitlist({ email: 'first@example.com' });
  joinWaitlist({ email: 'second@example.com' });

  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code });

  const promotedSeat = eventStore.getEvent().seats[0];
  assert.equal(promotedSeat.status, 'held');
  assert.equal(promotedSeat.hold.email, 'first@example.com');
  assert.deepEqual(eventStore.getEvent().waitlist, ['second@example.com']);
});

test('promotion preserves FIFO order and creates a unique automatic hold', () => {
  const ownerHold = createSoldOutEventWithOwner();
  joinWaitlist({ email: 'first@example.com' });
  joinWaitlist({ email: 'second@example.com' });

  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code });
  const firstPromotedHold = eventStore.getEvent().seats[0].hold;

  assert.notEqual(firstPromotedHold.code, ownerHold.code);
  assert.equal(firstPromotedHold.email, 'first@example.com');
  assert.deepEqual(eventStore.getEvent().waitlist, ['second@example.com']);
});

test('an automatic hold uses the normal expiry duration but not hourly history', () => {
  const currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const ownerHold = createSoldOutEventWithOwner(fakeClock);
  joinWaitlist({ email: 'first@example.com' }, fakeClock);

  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code }, fakeClock);

  const automaticHold = eventStore.getEvent().seats[0].hold;
  assert.equal(
    Date.parse(automaticHold.expiresAt) - currentTime.getTime(),
    config.holdExpirySeconds * 1000
  );
  assert.equal(
    eventStore.getEvent().holdHistory.some((record) => (
      record.email === 'first@example.com'
    )),
    false
  );
});

test('an automatic hold still counts toward the active-hold limit', () => {
  const ownerHold = createSoldOutEventWithOwner();
  joinWaitlist({ email: 'first@example.com' });
  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code });

  eventStore.getEvent().seats[1].status = 'available';
  createHold({ email: 'first@example.com', seatNumber: 2 });
  eventStore.getEvent().seats[2].status = 'available';

  assert.throws(
    () => createHold({ email: 'first@example.com', seatNumber: 3 }),
    { code: 'MAX_ACTIVE_HOLDS_EXCEEDED', statusCode: 409 }
  );
});

test('an expired automatic hold promotes the next waitlisted user', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const ownerHold = createSoldOutEventWithOwner(fakeClock);
  joinWaitlist({ email: 'first@example.com' }, fakeClock);
  joinWaitlist({ email: 'second@example.com' }, fakeClock);

  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code }, fakeClock);
  const firstAutomaticHold = eventStore.getEvent().seats[0].hold;
  currentTime = new Date(firstAutomaticHold.expiresAt);
  expireHolds(fakeClock);

  const secondAutomaticHold = eventStore.getEvent().seats[0].hold;
  assert.equal(secondAutomaticHold.email, 'second@example.com');
  assert.deepEqual(eventStore.getEvent().waitlist, []);
  assert.notEqual(secondAutomaticHold.code, firstAutomaticHold.code);
});

test('the original promoted user must rejoin the waitlist after expiry', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const ownerHold = createSoldOutEventWithOwner(fakeClock);
  joinWaitlist({ email: 'first@example.com' }, fakeClock);

  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code }, fakeClock);
  const firstAutomaticHold = eventStore.getEvent().seats[0].hold;
  currentTime = new Date(firstAutomaticHold.expiresAt);
  expireHolds(fakeClock);

  assert.equal(eventStore.getEvent().waitlist.includes('first@example.com'), false);
  eventStore.getEvent().seats[0].status = 'confirmed';
  joinWaitlist({ email: 'first@example.com' }, fakeClock);
  assert.deepEqual(eventStore.getEvent().waitlist, ['first@example.com']);
});

test('promotion writes a notification to the server log', () => {
  const ownerHold = createSoldOutEventWithOwner();
  joinWaitlist({ email: 'first@example.com' });
  const messages = [];
  const originalLog = console.log;
  console.log = (message) => messages.push(message);

  try {
    releaseHold({ email: ownerHold.email, holdCode: ownerHold.code });
  } finally {
    console.log = originalLog;
  }

  assert.equal(messages.length, 1);
  assert.match(messages[0], /\[WAITLIST\].*first@example\.com.*seat 1.*Hold code:/);
});
