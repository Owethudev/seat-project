const express = require('express');
const {
  confirmHold,
  createHold,
  extendHold,
  releaseHold
} = require('../services/holdService');

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

router.post('/holds/confirm', (request, response) => {
  try {
    const confirmation = confirmHold(request.body || {});
    response.json({ confirmation });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred.'
      }
    });
  }
});

router.post('/holds/extend', (request, response) => {
  try {
    const hold = extendHold(request.body || {});
    response.json({ hold });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred.'
      }
    });
  }
});

router.post('/holds/release', (request, response) => {
  try {
    const release = releaseHold(request.body || {});
    response.json({ release });
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
