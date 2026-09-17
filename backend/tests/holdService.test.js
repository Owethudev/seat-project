const assert = require('node:assert/strict');
const test = require('node:test');

const config = require('../src/config/config');
const eventStore = require('../src/storage/eventStore');
const {
  createHold,
  expireHolds,
  getActiveHold,
  isHoldExpired
} = require('../src/services/holdService');
const { generateHoldCode } = require('../src/utils/holdCode');

test.afterEach(() => {
  eventStore.resetEvent();
});

test('creates a hold for an available seat', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 5 });
  const seat = eventStore.getEvent().seats[4];
  const createdAt = Date.parse(hold.createdAt);
  const expiresAt = Date.parse(hold.expiresAt);

  assert.equal(hold.email, 'user@example.com');
  assert.equal(hold.seatNumber, 5);
  assert.equal(expiresAt - createdAt, config.holdExpirySeconds * 1000);
  assert.equal(seat.status, 'held');
  assert.deepEqual(seat.hold, {
    code: hold.code,
    email: hold.email,
    createdAt: hold.createdAt,
    expiresAt: hold.expiresAt
  });
});

test('rejects an invalid seat number', () => {
  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 0 }),
    { code: 'INVALID_SEAT_NUMBER', statusCode: 400 }
  );
});

test('rejects a seat that does not exist', () => {
  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: config.seatsPerEvent + 1 }),
    { code: 'SEAT_NOT_FOUND', statusCode: 404 }
  );
});

test('rejects a seat that is already held', () => {
  createHold({ email: 'first@example.com', seatNumber: 1 });

  assert.throws(
    () => createHold({ email: 'second@example.com', seatNumber: 1 }),
    { code: 'SEAT_UNAVAILABLE', statusCode: 409 }
  );
});

test('hold codes are six characters and use only allowed characters', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  assert.match(hold.code, /^[A-HJ-NP-Z2-9]{6}$/);
});

test('generated hold codes never contain excluded characters', () => {
  for (let index = 0; index < 100; index += 1) {
    const holdCode = generateHoldCode();

    assert.equal(holdCode.length, 6);
    assert.doesNotMatch(holdCode, /[0O1IL]/);
  }
});

test('hold codes are unique among active holds', () => {
  const holds = [];

  for (let seatNumber = 1; seatNumber <= config.seatsPerEvent; seatNumber += 1) {
    holds.push(createHold({
      email: `user${seatNumber}@example.com`,
      seatNumber
    }));
  }

  assert.equal(new Set(holds.map((hold) => hold.code)).size, holds.length);
});

test('hold has an expiry time and is valid before expiry', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  assert.equal(
    Date.parse(hold.expiresAt) - Date.parse(hold.createdAt),
    config.holdExpirySeconds * 1000
  );
  assert.equal(isHoldExpired(hold, fakeClock), false);
  assert.deepEqual(getActiveHold(hold.code, fakeClock), hold);

  currentTime = new Date(hold.expiresAt);
  assert.equal(isHoldExpired(hold, fakeClock), true);
});

test('an expired hold cannot be treated as active', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  currentTime = new Date(hold.expiresAt);

  assert.throws(
    () => getActiveHold(hold.code, fakeClock),
    { code: 'HOLD_EXPIRED', statusCode: 409 }
  );
});

test('expiry processing frees an expired hold seat', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  currentTime = new Date(hold.expiresAt);

  assert.equal(expireHolds(fakeClock), 1);
  assert.equal(eventStore.getEvent().seats[0].status, 'available');
  assert.equal(eventStore.getEvent().seats[0].hold, undefined);
});
