const assert = require('node:assert/strict');
const test = require('node:test');

const config = require('../src/config/config');
const eventStore = require('../src/storage/eventStore');

test('the event has the configured number of seats', () => {
  const event = eventStore.getEvent();

  assert.equal(event.seats.length, config.seatsPerEvent);
});

test('seat numbering starts at 1', () => {
  const event = eventStore.getEvent();

  assert.equal(event.seats[0].number, 1);
});

test('seat numbering ends at the configured number', () => {
  const event = eventStore.getEvent();
  const lastSeat = event.seats[event.seats.length - 1];

  assert.equal(lastSeat.number, config.seatsPerEvent);
});

test('all seats initially have available status', () => {
  const event = eventStore.getEvent();

  for (const seat of event.seats) {
    assert.equal(seat.status, 'available');
  }
});
