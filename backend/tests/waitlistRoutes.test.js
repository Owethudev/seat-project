const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const app = require('../src/app');
const eventStore = require('../src/storage/eventStore');

function sendWaitlistRequest(server, body) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/waitlist',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (response) => {
      let responseBody = '';

      response.on('data', (chunk) => {
        responseBody += chunk;
      });

      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: JSON.parse(responseBody)
        });
      });
    });

    request.on('error', reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

test('POST /api/waitlist accepts a user when the event is sold out', async () => {
  for (const seat of eventStore.getEvent().seats) {
    seat.status = 'confirmed';
  }

  const server = app.listen(0);

  try {
    const result = await sendWaitlistRequest(server, {
      email: 'user@example.com'
    });

    assert.equal(result.statusCode, 201);
    assert.deepEqual(result.body.waitlistEntry, {
      email: 'user@example.com',
      position: 1,
      status: 'waiting'
    });
  } finally {
    eventStore.resetEvent();
    server.close();
  }
});
