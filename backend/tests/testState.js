const eventLogStore = require('../src/storage/eventLogStore');
const eventStore = require('../src/storage/eventStore');

function resetState() {
  eventStore.resetEvent();
  eventLogStore.resetEvents();
}

module.exports = {
  resetState
};
