const config = require('../config/config');
const { createEvent } = require('../models/event');

let currentEvent = createEvent(config.seatsPerEvent);

function getEvent() {
  return currentEvent;
}

function updateEvent(event) {
  currentEvent = event;
}

module.exports = {
  getEvent,
  updateEvent
};
