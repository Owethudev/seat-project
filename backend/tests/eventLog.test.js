const assert = require('node:assert/strict');
const test = require('node:test');

const eventLogStore = require('../src/storage/eventLogStore');
const eventStore = require('../src/storage/eventStore');
const {
  confirmHold,
  createHold,
  expireHolds,
  extendHold,
  releaseHold
} = require('../src/services/holdService');
const { joinWaitlist } = require('../src/services/waitlistService');

test.beforeEach(() => {
  eventStore.resetEvent();
  eventLogStore.resetEvents();
});

test('placing a hold creates a HOLD_PLACED event', () => {
  const currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 }, fakeClock);
  const [event] = eventLogStore.getEvents();

  assert.equal(event.type, 'HOLD_PLACED');
  assert.equal(event.seatNumber, 1);
  assert.equal(event.email, hold.email);
  assert.equal(event.holdCode, hold.code);
  assert.equal(event.timestamp, currentTime.toISOString());
});

test('extending a hold creates a HOLD_EXTENDED event', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 }, fakeClock);
  currentTime = new Date('2026-09-17T12:00:10.000Z');

  extendHold({ email: hold.email, holdCode: hold.code }, fakeClock);

  assert.equal(eventLogStore.getEvents()[1].type, 'HOLD_EXTENDED');
});

test('confirming a hold creates a HOLD_CONFIRMED event', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  confirmHold({ email: hold.email, holdCode: hold.code });

  assert.equal(eventLogStore.getEvents()[1].type, 'HOLD_CONFIRMED');
});

test('releasing a hold creates a HOLD_RELEASED event', () => {
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 });

  releaseHold({ email: hold.email, holdCode: hold.code });

  assert.equal(eventLogStore.getEvents()[1].type, 'HOLD_RELEASED');
});

test('expiring a hold creates a HOLD_EXPIRED event', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 }, fakeClock);
  currentTime = new Date(hold.expiresAt);

  expireHolds(fakeClock);

  assert.equal(eventLogStore.getEvents()[1].type, 'HOLD_EXPIRED');
});

test('joining the waitlist creates a WAITLIST_JOINED event', () => {
  for (const seat of eventStore.getEvent().seats) {
    seat.status = 'confirmed';
  }

  joinWaitlist({ email: 'user@example.com' });

  const event = eventLogStore.getEvents()[0];
  assert.equal(event.type, 'WAITLIST_JOINED');
  assert.equal(event.email, 'user@example.com');
});

test('promotion creates HOLD_PLACED and WAITLIST_PROMOTED events', () => {
  const ownerHold = createHold({ email: 'owner@example.com', seatNumber: 1 });
  for (const seat of eventStore.getEvent().seats.slice(1)) {
    seat.status = 'confirmed';
  }
  joinWaitlist({ email: 'user@example.com' });

  releaseHold({ email: ownerHold.email, holdCode: ownerHold.code });

  const eventTypes = eventLogStore.getEvents().map((event) => event.type);
  assert.deepEqual(eventTypes, [
    'HOLD_PLACED',
    'WAITLIST_JOINED',
    'HOLD_RELEASED',
    'HOLD_PLACED',
    'WAITLIST_PROMOTED'
  ]);
});

test('events have timestamps and remain in insertion order', () => {
  let currentTime = new Date('2026-09-17T12:00:00.000Z');
  const fakeClock = () => currentTime;
  const hold = createHold({ email: 'user@example.com', seatNumber: 1 }, fakeClock);
  currentTime = new Date('2026-09-17T12:00:10.000Z');
  extendHold({ email: hold.email, holdCode: hold.code }, fakeClock);

  const events = eventLogStore.getEvents();
  assert.equal(events.length, 2);
  assert.equal(events.every((event) => typeof event.timestamp === 'string'), true);
  assert.equal(Date.parse(events[0].timestamp) <= Date.parse(events[1].timestamp), true);
});

test('events cannot be modified after being added', () => {
  const input = { type: 'TEST_EVENT', seatNumber: 1 };
  const addedEvent = eventLogStore.addEvent(input);
  input.type = 'CHANGED_INPUT';
  addedEvent.type = 'CHANGED_RESULT';

  const events = eventLogStore.getEvents();
  events[0].type = 'CHANGED_READ_COPY';
  events.push({ type: 'FAKE_EVENT' });

  assert.equal(eventLogStore.getEvents().length, 1);
  assert.equal(eventLogStore.getEvents()[0].type, 'TEST_EVENT');
});
