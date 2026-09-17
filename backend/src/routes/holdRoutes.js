const express = require('express');
const {
  confirmHold,
  createHold,
  extendHold,
  releaseHold
} = require('../services/holdService');
const {
  requireEmail,
  requireHoldCode,
  requireSeatNumber,
  sendError
} = require('./routeHelpers');

const router = express.Router();

router.post('/holds', (request, response) => {
  try {
    requireEmail(request.body || {});
    requireSeatNumber(request.body || {});
    const hold = createHold(request.body || {});
    response.status(201).json({ hold });
  } catch (error) {
    sendError(response, error);
  }
});

router.post('/holds/confirm', (request, response) => {
  try {
    requireEmail(request.body || {});
    requireHoldCode(request.body || {});
    const confirmation = confirmHold(request.body || {});
    response.json({ confirmation });
  } catch (error) {
    sendError(response, error);
  }
});

router.post('/holds/extend', (request, response) => {
  try {
    requireEmail(request.body || {});
    requireHoldCode(request.body || {});
    const hold = extendHold(request.body || {});
    response.json({ hold });
  } catch (error) {
    sendError(response, error);
  }
});

router.post('/holds/release', (request, response) => {
  try {
    requireEmail(request.body || {});
    requireHoldCode(request.body || {});
    const release = releaseHold(request.body || {});
    response.json({ release });
  } catch (error) {
    sendError(response, error);
  }
});

module.exports = router;
