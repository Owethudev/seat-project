const express = require('express');
const { joinWaitlist } = require('../services/waitlistService');

const router = express.Router();

router.post('/waitlist', (request, response) => {
  try {
    const waitlistEntry = joinWaitlist(request.body || {});
    response.status(201).json({ waitlistEntry });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred.'
      }
    });
  }
});

module.exports = router;
