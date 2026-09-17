const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const app = require('../src/app');
const eventLogStore = require('../src/storage/eventLogStore');
const eventStore = require('../src/storage/eventStore');

function sendRequest(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
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

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

function resetState() {
  eventStore.resetEvent();
  eventLogStore.resetEvents();
}

async function withServer(callback) {
  const server = app.listen(0);

  try {
    return await callback(server);
  } finally {
    resetState();
    server.close();
  }
}

test('GET /api/health returns an API health response', async () => {
  await withServer(async (server) => {
    const result = await sendRequest(server, 'GET', '/api/health');

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { status: 'ok' });
  });
});

test('GET /api/seats returns public seat numbers and statuses', async () => {
  await withServer(async (server) => {
    const result = await sendRequest(server, 'GET', '/api/seats');

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.seats.length, 20);
    assert.deepEqual(result.body.seats[0], {
      number: 1,
      status: 'available'
    });
    assert.equal(Object.hasOwn(result.body.seats[0], 'hold'), false);
  });
});

test('hold, confirm, extend, and release endpoints return successful responses', async () => {
  await withServer(async (server) => {
    const holdResult = await sendRequest(server, 'POST', '/api/holds', {
      email: 'user@example.com',
      seatNumber: 1
    });
    const hold = holdResult.body.hold;

    const confirmResult = await sendRequest(server, 'POST', '/api/holds/confirm', {
      email: hold.email,
      holdCode: hold.code
    });
    assert.equal(holdResult.statusCode, 201);
    assert.equal(confirmResult.statusCode, 200);

    resetState();
    const secondHoldResult = await sendRequest(server, 'POST', '/api/holds', {
      email: 'user@example.com',
      seatNumber: 1
    });
    const secondHold = secondHoldResult.body.hold;
    const extendResult = await sendRequest(server, 'POST', '/api/holds/extend', {
      email: secondHold.email,
      holdCode: secondHold.code
    });
    const releaseResult = await sendRequest(server, 'POST', '/api/holds/release', {
      email: secondHold.email,
      holdCode: secondHold.code
    });

    assert.equal(extendResult.statusCode, 200);
    assert.equal(releaseResult.statusCode, 200);
  });
});

test('POST /api/waitlist accepts a user when all seats are unavailable', async () => {
  await withServer(async (server) => {
    for (const seat of eventStore.getEvent().seats) {
      seat.status = 'confirmed';
    }

    const result = await sendRequest(server, 'POST', '/api/waitlist', {
      email: 'user@example.com'
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.waitlistEntry.position, 1);
  });
});

test('GET /api/events returns events and filters by seat number', async () => {
  await withServer(async (server) => {
    await sendRequest(server, 'POST', '/api/holds', {
      email: 'first@example.com',
      seatNumber: 1
    });
    await sendRequest(server, 'POST', '/api/holds', {
      email: 'second@example.com',
      seatNumber: 2
    });

    const allEvents = await sendRequest(server, 'GET', '/api/events');
    const seatEvents = await sendRequest(server, 'GET', '/api/events?seatNumber=1');

    assert.equal(allEvents.statusCode, 200);
    assert.equal(allEvents.body.events.length, 2);
    assert.equal(seatEvents.statusCode, 200);
    assert.equal(seatEvents.body.events.length, 1);
    assert.equal(seatEvents.body.events[0].seatNumber, 1);
  });
});

test('API validation returns consistent errors', async () => {
  await withServer(async (server) => {
    const invalidHold = await sendRequest(server, 'POST', '/api/holds', {
      email: 'user@example.com',
      seatNumber: 1
    });
    const invalidCode = await sendRequest(server, 'POST', '/api/holds/confirm', {
      email: 'user@example.com',
      holdCode: 'bad'
    });
    const invalidFilter = await sendRequest(server, 'GET', '/api/events?seatNumber=bad');

    assert.equal(invalidHold.statusCode, 201);
    assert.equal(invalidCode.statusCode, 400);
    assert.deepEqual(invalidCode.body.error, {
      code: 'INVALID_HOLD_CODE',
      message: 'Hold code must contain six allowed uppercase letters or digits.'
    });
    assert.equal(invalidFilter.statusCode, 400);
    assert.equal(invalidFilter.body.error.code, 'INVALID_SEAT_NUMBER');
  });
});

test('concurrent requests for one seat create exactly one hold', async () => {
  await withServer(async (server) => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => sendRequest(
        server,
        'POST',
        '/api/holds',
        {
          email: `user${index}@example.com`,
          seatNumber: 1
        }
      ))
    );
    const successfulResults = results.filter((result) => result.statusCode === 201);
    const eventLog = await sendRequest(server, 'GET', '/api/events?seatNumber=1');
    const seat = eventStore.getEvent().seats[0];

    assert.equal(successfulResults.length, 1);
    assert.equal(results.filter((result) => result.statusCode >= 400).length, 9);
    assert.equal(seat.status, 'held');
    assert.equal(seat.hold.email, successfulResults[0].body.hold.email);
    assert.equal(eventLog.body.events.filter((event) => event.type === 'HOLD_PLACED').length, 1);
  });
});

test('concurrent requests for different seats succeed independently', async () => {
  await withServer(async (server) => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => sendRequest(
        server,
        'POST',
        '/api/holds',
        {
          email: `user${index}@example.com`,
          seatNumber: index + 1
        }
      ))
    );

    assert.equal(results.filter((result) => result.statusCode === 201).length, 10);
    assert.equal(eventStore.getEvent().seats.filter((seat) => seat.status === 'held').length, 10);
    assert.equal(new Set(
      eventStore.getEvent().seats
        .filter((seat) => seat.status === 'held')
        .map((seat) => seat.hold.email)
    ).size, 10);
  });
});
