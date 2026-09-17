const assert = require('node:assert/strict');
const test = require('node:test');

const config = require('../src/config/config');
const eventStore = require('../src/storage/eventStore');
const {
  confirmHold,
  createHold,
  extendHold,
  expireHolds,
  getActiveHold,
  isHoldExpired,
  releaseHold
} = require('../src/services/holdService');
const { generateHoldCode } = require('../src/utils/holdCode');
const { resetState } = require('./testState');

test.afterEach(() => {
  resetState();
});

function setSeatStatus(seatNumber, status) {
  eventStore.getEvent().seats[seatNumber - 1].status = status;
}

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
    expiresAt: hold.expiresAt,
    extensionCount: 0
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

test('a user can have two active holds', () => {
  createHold({ email: 'user@example.com', seatNumber: 1 });
  createHold({ email: 'user@example.com', seatNumber: 2 });

  assert.equal(eventStore.getEvent().seats[0].status, 'held');
  assert.equal(eventStore.getEvent().seats[1].status, 'held');
});

test('a user cannot create a third active hold', () => {
  createHold({ email: 'user@example.com', seatNumber: 1 });
  createHold({ email: 'user@example.com', seatNumber: 2 });

  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 3 }),
    { code: 'MAX_ACTIVE_HOLDS_EXCEEDED', statusCode: 409 }
  );
});

test('confirmed holds do not count toward the active-hold limit', () => {
  createHold({ email: 'user@example.com', seatNumber: 1 });
  setSeatStatus(1, 'confirmed');

  createHold({ email: 'user@example.com', seatNumber: 2 });
  createHold({ email: 'user@example.com', seatNumber: 3 });

  assert.equal(eventStore.getEvent().seats[2].status, 'held');
});

test('expired holds do not count toward the active-hold limit', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const firstHold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  currentTime = new Date(firstHold.expiresAt);
  createHold({ email: 'user@example.com', seatNumber: 2 }, fakeClock);
  createHold({ email: 'user@example.com', seatNumber: 3 }, fakeClock);

  assert.equal(eventStore.getEvent().seats[0].status, 'available');
});

test('released holds do not count toward the active-hold limit', () => {
  createHold({ email: 'user@example.com', seatNumber: 1 });
  setSeatStatus(1, 'available');

  createHold({ email: 'user@example.com', seatNumber: 2 });
  createHold({ email: 'user@example.com', seatNumber: 3 });

  assert.equal(eventStore.getEvent().seats[2].status, 'held');
});

test('a user can create five holds within one hour', () => {
  for (let seatNumber = 1; seatNumber <= 5; seatNumber += 1) {
    createHold({ email: 'user@example.com', seatNumber });
    setSeatStatus(seatNumber, 'available');
  }

  assert.equal(eventStore.getEvent().holdHistory.length, 5);
});

test('a user cannot create a sixth hold within one hour', () => {
  for (let seatNumber = 1; seatNumber <= 5; seatNumber += 1) {
    createHold({ email: 'user@example.com', seatNumber });
    setSeatStatus(seatNumber, 'available');
  }

  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 6 }),
    { code: 'HOLD_RATE_LIMIT_EXCEEDED', statusCode: 429 }
  );
});

test('confirmed holds still count toward the hourly limit', () => {
  for (let seatNumber = 1; seatNumber <= 5; seatNumber += 1) {
    createHold({ email: 'user@example.com', seatNumber });
    setSeatStatus(seatNumber, 'confirmed');
  }

  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 6 }),
    { code: 'HOLD_RATE_LIMIT_EXCEEDED', statusCode: 429 }
  );
});

test('released holds still count toward the hourly limit', () => {
  for (let seatNumber = 1; seatNumber <= 5; seatNumber += 1) {
    createHold({ email: 'user@example.com', seatNumber });
    setSeatStatus(seatNumber, 'available');
  }

  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 6 }),
    { code: 'HOLD_RATE_LIMIT_EXCEEDED', statusCode: 429 }
  );
});

test('expired holds still count toward the hourly limit', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;

  for (let holdNumber = 0; holdNumber < 5; holdNumber += 1) {
    const hold = createHold(
      { email: 'user@example.com', seatNumber: 1 },
      fakeClock
    );
    currentTime = new Date(hold.expiresAt);
    expireHolds(fakeClock);
  }

  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 1 }, fakeClock),
    { code: 'HOLD_RATE_LIMIT_EXCEEDED', statusCode: 429 }
  );
});

test('old hold history no longer prevents a hold after one hour', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;

  for (let seatNumber = 1; seatNumber <= 5; seatNumber += 1) {
    createHold({ email: 'user@example.com', seatNumber }, fakeClock);
    setSeatStatus(seatNumber, 'available');
  }

  currentTime = new Date('2026-09-17T13:00:00.001Z');
  const newHold = createHold(
    { email: 'user@example.com', seatNumber: 6 },
    fakeClock
  );

  assert.equal(newHold.seatNumber, 6);
});

test('confirms a valid hold for the matching email', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  const confirmation = confirmHold({
    email: hold.email,
    holdCode: hold.code
  });

  assert.deepEqual(confirmation, {
    seatNumber: 1,
    holdCode: hold.code,
    email: hold.email,
    status: 'confirmed'
  });
  assert.equal(eventStore.getEvent().seats[0].status, 'confirmed');
});

test('rejects confirmation when the email does not match', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  assert.throws(
    () => confirmHold({ email: 'other@example.com', holdCode: hold.code }),
    { code: 'HOLD_EMAIL_MISMATCH', statusCode: 403 }
  );
});

test('rejects an invalid hold code', () => {
  assert.throws(
    () => confirmHold({ email: 'user@example.com', holdCode: 'MISSING' }),
    { code: 'HOLD_NOT_FOUND', statusCode: 404 }
  );
});

test('an expired hold cannot be confirmed', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  currentTime = new Date(hold.expiresAt);

  assert.throws(
    () => confirmHold({ email: hold.email, holdCode: hold.code }, fakeClock),
    { code: 'HOLD_EXPIRED', statusCode: 409 }
  );
});

test('a confirmed seat no longer expires', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  confirmHold({ email: hold.email, holdCode: hold.code }, fakeClock);
  currentTime = new Date(hold.expiresAt);
  expireHolds(fakeClock);

  assert.equal(eventStore.getEvent().seats[0].status, 'confirmed');
  assert.equal(eventStore.getEvent().seats[0].hold.email, hold.email);
});

test('confirming the same hold twice returns the same result', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  const firstConfirmation = confirmHold({
    email: hold.email,
    holdCode: hold.code
  });
  const stateAfterFirstConfirmation = JSON.stringify(eventStore.getEvent());
  const secondConfirmation = confirmHold({
    email: hold.email,
    holdCode: hold.code
  });

  assert.deepEqual(secondConfirmation, firstConfirmation);
  assert.equal(
    JSON.stringify(eventStore.getEvent()),
    stateAfterFirstConfirmation
  );
});

test('second confirmation does not create another hold or lose the user association', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  confirmHold({ email: hold.email, holdCode: hold.code });
  confirmHold({ email: hold.email, holdCode: hold.code });

  const event = eventStore.getEvent();
  assert.equal(event.holdHistory.length, 1);
  assert.equal(event.seats.filter((seat) => seat.hold).length, 1);
  assert.equal(event.seats[0].hold.email, hold.email);
});

test('an active hold can be extended and its expiry resets', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );
  currentTime = new Date('2026-09-17T12:00:10.000Z');

  const extendedHold = extendHold({
    email: hold.email,
    holdCode: hold.code
  }, fakeClock);

  assert.equal(extendedHold.extensionCount, 1);
  assert.equal(
    Date.parse(extendedHold.expiresAt) - currentTime.getTime(),
    config.holdExpirySeconds * 1000
  );
});

test('a hold cannot be extended more than twice', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );

  extendHold({ email: hold.email, holdCode: hold.code }, fakeClock);
  extendHold({ email: hold.email, holdCode: hold.code }, fakeClock);

  assert.throws(
    () => extendHold({ email: hold.email, holdCode: hold.code }, fakeClock),
    { code: 'MAX_EXTENSIONS_EXCEEDED', statusCode: 409 }
  );
});

test('an expired hold cannot be extended', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold(
    { email: 'user@example.com', seatNumber: 1 },
    fakeClock
  );
  currentTime = new Date(hold.expiresAt);

  assert.throws(
    () => extendHold({ email: hold.email, holdCode: hold.code }, fakeClock),
    { code: 'HOLD_EXPIRED', statusCode: 409 }
  );
});

test('a confirmed seat cannot be extended', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  confirmHold({ email: hold.email, holdCode: hold.code });

  assert.throws(
    () => extendHold({ email: hold.email, holdCode: hold.code }),
    { code: 'HOLD_CONFIRMED', statusCode: 409 }
  );
});

test('the wrong email cannot extend a hold', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  assert.throws(
    () => extendHold({ email: 'other@example.com', holdCode: hold.code }),
    { code: 'HOLD_EMAIL_MISMATCH', statusCode: 403 }
  );
});

test('an active hold can be released and its seat becomes available', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  const release = releaseHold({ email: hold.email, holdCode: hold.code });
  const seat = eventStore.getEvent().seats[0];

  assert.deepEqual(release, {
    seatNumber: 1,
    holdCode: hold.code,
    email: hold.email,
    status: 'released'
  });
  assert.equal(seat.status, 'available');
  assert.equal(seat.hold, undefined);
});

test('a confirmed seat can be released', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  confirmHold({ email: hold.email, holdCode: hold.code });

  releaseHold({ email: hold.email, holdCode: hold.code });

  assert.equal(eventStore.getEvent().seats[0].status, 'available');
});

test('the wrong email cannot release a hold', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  assert.throws(
    () => releaseHold({ email: 'other@example.com', holdCode: hold.code }),
    { code: 'HOLD_EMAIL_MISMATCH', statusCode: 403 }
  );
});

test('a released hold code cannot be reused', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
  releaseHold({ email: hold.email, holdCode: hold.code });

  const replacementHold = createHold({ email: hold.email, seatNumber: 1 });

  assert.notEqual(replacementHold.code, hold.code);
});

test('released holds remain in hourly hold history', () => {
  for (let holdNumber = 0; holdNumber < 5; holdNumber += 1) {
    const hold = createHold({ email: 'user@example.com', seatNumber: 1 });
    releaseHold({ email: hold.email, holdCode: hold.code });
  }

  assert.throws(
    () => createHold({ email: 'user@example.com', seatNumber: 1 }),
    { code: 'HOLD_RATE_LIMIT_EXCEEDED', statusCode: 429 }
  );
});
