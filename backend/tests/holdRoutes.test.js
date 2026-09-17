const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const app = require('../src/app');
const eventStore = require('../src/storage/eventStore');

function sendHoldRequest(server, body, path = '/api/holds') {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
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

test('POST /api/holds creates a hold and returns HTTP 201', async () => {
  const server = app.listen(0);

  try {
    const result = await sendHoldRequest(server, {
      email: 'user@example.com',
      seatNumber: 5
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.hold.email, 'user@example.com');
    assert.equal(result.body.hold.seatNumber, 5);
  } finally {
    eventStore.resetEvent();
    server.close();
  }
});

test('POST /api/holds returns a consistent error for invalid email', async () => {
  const server = app.listen(0);

  try {
    const result = await sendHoldRequest(server, {
      email: 'not-an-email',
      seatNumber: 5
    });

    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.body.error, {
      code: 'INVALID_EMAIL',
      message: 'A valid email address is required.'
    });
  } finally {
    eventStore.resetEvent();
    server.close();
  }
});

test('POST /api/holds/confirm confirms a hold', async () => {
  const server = app.listen(0);

  try {
    const holdResult = await sendHoldRequest(server, {
      email: 'user@example.com',
      seatNumber: 1
    });
    const confirmationResult = await sendHoldRequest(
      server,
      {
        email: 'user@example.com',
        holdCode: holdResult.body.hold.code
      },
      '/api/holds/confirm'
    );

    assert.equal(confirmationResult.statusCode, 200);
    assert.equal(confirmationResult.body.confirmation.status, 'confirmed');
    assert.equal(confirmationResult.body.confirmation.seatNumber, 1);
  } finally {
    eventStore.resetEvent();
    server.close();
  }
});
