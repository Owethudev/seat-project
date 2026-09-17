const express = require('express');
const eventLogStore = require('../storage/eventLogStore');
const { sendError, createRequestError } = require('./routeHelpers');

const router = express.Router();

router.get('/events', (request, response) => {
  try {
    const { seatNumber } = request.query;
    let events = eventLogStore.getEvents();

    if (seatNumber !== undefined) {
      const parsedSeatNumber = Number(seatNumber);

      if (!Number.isInteger(parsedSeatNumber) || parsedSeatNumber <= 0) {
        throw createRequestError(
          'INVALID_SEAT_NUMBER',
          'Seat number must be a positive whole number.'
        );
      }

      events = events.filter((event) => event.seatNumber === parsedSeatNumber);
    }

    response.json({ events });
  } catch (error) {
    sendError(response, error);
  }
});

module.exports = router;
