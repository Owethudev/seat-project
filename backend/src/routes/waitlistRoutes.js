const express = require('express');
const { joinWaitlist } = require('../services/waitlistService');
const { requireEmail, sendError } = require('./routeHelpers');

const router = express.Router();

router.post('/waitlist', (request, response) => {
  try {
    requireEmail(request.body || {});
    const waitlistEntry = joinWaitlist(request.body || {});
    response.status(201).json({ waitlistEntry });
  } catch (error) {
    sendError(response, error);
  }
});

module.exports = router;
