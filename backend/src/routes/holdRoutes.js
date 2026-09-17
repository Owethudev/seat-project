const express = require('express');
const { createHold } = require('../services/holdService');

const router = express.Router();

router.post('/holds', (request, response) => {
  try {
    const hold = createHold(request.body || {});
    response.status(201).json({ hold });
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
