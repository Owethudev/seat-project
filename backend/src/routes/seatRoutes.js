const express = require('express');
const eventStore = require('../storage/eventStore');

const router = express.Router();

router.get('/seats', (request, response) => {
  const seats = eventStore.getEvent().seats.map((seat) => ({
    number: seat.number,
    status: seat.status
  }));

  response.json({ seats });
});

module.exports = router;
