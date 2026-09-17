const { getCurrentTime } = require('../utils/clock');

const events = [];

function addEvent(event, getTime = getCurrentTime) {
  const storedEvent = Object.freeze({
    ...event,
    timestamp: getTime().toISOString()
  });

  events.push(storedEvent);
  return { ...storedEvent };
}

function getEvents() {
  return events.map((event) => ({ ...event }));
}

function resetEvents() {
  events.length = 0;
}

module.exports = {
  addEvent,
  getEvents,
  resetEvents
};
