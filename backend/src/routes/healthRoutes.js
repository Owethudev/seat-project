const express = require('express');

const router = express.Router();

router.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

module.exports = router;
