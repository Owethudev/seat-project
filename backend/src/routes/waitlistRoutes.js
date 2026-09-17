const express = require('express');
const { joinWaitlist } = require('../services/waitlistService');
const { requireEmail, sendError } = require('./routeHelpers');
const { runExclusive } = require('../utils/mutex');

const router = express.Router();

router.post('/waitlist', async (request, response) => {
  try {
    requireEmail(request.body || {});
    const waitlistEntry = await runExclusive(() => joinWaitlist(request.body || {}));
    response.status(201).json({ waitlistEntry });
  } catch (error) {
    sendError(response, error);
  }
});

module.exports = router;
