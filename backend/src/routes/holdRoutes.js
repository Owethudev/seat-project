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
const { runExclusive } = require('../utils/mutex');

const router = express.Router();

router.post('/holds', async (request, response) => {
  try {
    requireEmail(request.body || {});
    requireSeatNumber(request.body || {});
    const hold = await runExclusive(() => createHold(request.body || {}));
    response.status(201).json({ hold });
  } catch (error) {
    sendError(response, error);
  }
});

router.post('/holds/confirm', async (request, response) => {
  try {
    requireEmail(request.body || {});
    requireHoldCode(request.body || {});
    const confirmation = await runExclusive(() => confirmHold(request.body || {}));
    response.json({ confirmation });
  } catch (error) {
    sendError(response, error);
  }
});

router.post('/holds/extend', async (request, response) => {
  try {
    requireEmail(request.body || {});
    requireHoldCode(request.body || {});
    const hold = await runExclusive(() => extendHold(request.body || {}));
    response.json({ hold });
  } catch (error) {
    sendError(response, error);
  }
});

router.post('/holds/release', async (request, response) => {
  try {
    requireEmail(request.body || {});
    requireHoldCode(request.body || {});
    const release = await runExclusive(() => releaseHold(request.body || {}));
    response.json({ release });
  } catch (error) {
    sendError(response, error);
  }
});

module.exports = router;
