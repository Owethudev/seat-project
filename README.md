# Ticket Reservation System

A Node.js and Express ticket reservation API with a React seat-map frontend. The system supports temporary seat holds, expiry, per-user limits, confirmation, extension, release, FIFO waitlist promotion, an append-only event log, and protection against concurrent reservations for the same seat.

This project is intentionally simple and uses in-memory state for the current assessment.

## Requirements

- One event with a configurable number of seats
- Temporary holds with configurable expiry
- Per-user active-hold and hourly-hold limits
- Hold confirmation, extension, and release
- FIFO waitlist joining and automatic promotion
- Read-only event history
- Single-process concurrency protection
- React seat map and management screens

## Technology

- Node.js with JavaScript
- Express for the backend API
- React for the frontend
- Vite for frontend development and building
- Node's built-in test runner
- In-memory arrays and objects for storage

No TypeScript, database, authentication system, WebSockets, or external state-management library is required.

## Project Structure

```text
backend/
  src/
    app.js                 Express application setup
    server.js              HTTP server startup
    config/                Central configuration values
    models/                Event and seat data creation
    routes/                HTTP request and response handling
    services/              Reservation and waitlist business rules
    storage/               In-memory event state and append-only event log
    utils/                 Clock, hold-code, validation, and mutex helpers
  tests/                   Business-rule, API, event-log, and concurrency tests
frontend/
  src/
    App.jsx                Seat-map screen and screen navigation
    ManageHold.jsx         Confirm, extend, and release screen
    EventLog.jsx           Read-only event-log screen
    api.js                 Shared frontend API request helper
    main.jsx               React entry point
    styles.css             Frontend styling
  index.html               Vite HTML entry point
  vite.config.js           Vite setup and backend API proxy
```

Responsibilities are separated as follows:

- Routes handle HTTP input, validation, status codes, and JSON responses.
- Services contain business rules.
- Storage contains current in-memory state and event history.
- Utilities contain small reusable helpers.
- Tests verify business rules and API behavior.
- The frontend handles presentation, user interaction, and API calls.

## Configuration

All reservation configuration is in:

```text
backend/src/config/config.js
```

Change the values in that file and restart the backend. Do not scatter these values through services or routes.

| Configuration | Default | Meaning |
| --- | ---: | --- |
| `port` | `3000` | Port used by the backend HTTP server |
| `seatsPerEvent` | `20` | Number of seats created for the event |
| `holdExpirySeconds` | `60` | How long a temporary hold remains active |
| `maxActiveHoldsPerUser` | `2` | Maximum active, unconfirmed holds for one email |
| `maxHoldsPerHourPerUser` | `5` | Maximum holds created by one email in a rolling hour |
| `maxExtensionsPerHold` | `2` | Maximum extensions allowed for one hold |

Confirmed, released, and expired holds do not count toward the active-hold limit. Confirmed, released, and expired holds do count toward the hourly hold history. Automatic waitlist holds skip the hourly history limit but still count as active holds.

## Install and Run

### Backend

Open a terminal in the backend directory:

```bash
cd backend
npm install
npm start
```

The API runs at:

```text
http://localhost:3000
```

For development with Node's file watcher:

```bash
npm run dev
```

### Frontend

Open another terminal in the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

Vite proxies `/api` requests to the backend at `http://localhost:3000`.

### Automated tests

Run the complete backend suite:

```bash
cd backend
npm test
```

Build the frontend:

```bash
cd frontend
npm run build
```

## API

All API responses are JSON.

### Health

```text
GET /api/health
```

Example response:

```json
{
  "status": "ok"
}
```

### Seats

```text
GET /api/seats
```

Returns every seat with only its public number and status:

```json
{
  "seats": [
    { "number": 1, "status": "available" },
    { "number": 2, "status": "held" },
    { "number": 3, "status": "confirmed" }
  ]
}
```

### Place a hold

```text
POST /api/holds
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "seatNumber": 5
}
```

A successful request returns HTTP `201` and includes the hold code, creation time, expiry time, and extension count.

### Confirm a hold

```text
POST /api/holds/confirm
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "holdCode": "ABC123"
}
```

Confirmation is idempotent. Repeating the same valid request for an already confirmed seat returns success again without changing state.

### Extend a hold

```text
POST /api/holds/extend
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "holdCode": "ABC123"
}
```

The expiry resets to the full configured duration from the current time, subject to the extension limit.

### Release a hold or confirmed seat

```text
POST /api/holds/release
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "holdCode": "ABC123"
}
```

The seat becomes available. If someone is waiting, the first waitlisted user can be promoted automatically.

### Join the waitlist

```text
POST /api/waitlist
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com"
}
```

A user can join only when every seat is held or confirmed, and cannot join twice or join while they have an active hold or confirmed seat.

### Read the event log

```text
GET /api/events
```

Filter by seat number:

```text
GET /api/events?seatNumber=5
```

The response contains events in append order. Events include their type, timestamp, and relevant seat, email, and hold-code information.

## Error Responses

Rejected requests use one consistent shape:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Seat 5 is not available."
  }
}
```

Validation errors use HTTP `400`. Missing resources use `404`. Business conflicts use `409`. Rate-limit violations use `429`. The message comes from the rule that rejected the request so the frontend can display it directly.

## Hold Expiry

A hold receives an expiry time when it is created. The duration comes from `holdExpirySeconds` in the configuration.

Expiry is checked when reservation operations run. Expired holds are released from their seats, receive a `HOLD_EXPIRED` event, and can no longer be confirmed, extended, or released as active holds. If the waitlist has users, the newly available seat can be promoted immediately.

The clock is behind a small helper, so tests use fake times instead of waiting in real time.

## Waitlist

The waitlist is an in-memory array. New users are appended to the end, so the first person who joined is always at index zero and is promoted first.

When a seat becomes available because of release or expiry:

1. The first waitlisted email is removed from the array.
2. An automatic hold is created for that user.
3. The hold gets a unique code and normal expiry.
4. The promotion is recorded in the event log.
5. A formatted server-log notification is written.

Automatic holds do not count toward the user's hourly hold history, but they do count toward the active-hold limit. If an automatic hold expires, the next waitlisted user can receive the seat. The previous user must join the waitlist again.

## Concurrency

The API uses a simple in-process promise mutex in `backend/src/utils/mutex.js`.

Mutating reservation routes are serialized so that checking a seat and changing it to held happen in one protected operation. This prevents two concurrent requests from both successfully holding the same seat. The same protection covers confirmation, extension, release, waitlist joining, expiry triggered by a request, and promotion triggered by release or expiry.

This works for the current single Node.js process and in-memory storage. If the application ran on multiple server instances, a shared database transaction or distributed lock would be needed because an in-memory mutex would exist separately in each process.

## Event Log

The event log is append-only in `backend/src/storage/eventLogStore.js`. State changes create events for:

- hold placed
- hold extended
- hold confirmed
- hold released
- hold expired
- waitlist joined
- waitlist promoted

Events receive timestamps from the shared clock and are stored in insertion order. The log returns copies of events so callers cannot modify historical records. It could later be replaced with a database table or append-only event stream while keeping the business rules separate from storage.

## In-Memory Storage and Future Database

The current event, seats, hold history, used hold codes, and waitlist are stored in memory. Restarting the backend clears that state.

The storage modules provide small access functions instead of exposing storage details throughout the services. A future database implementation could replace these modules with database reads and writes while keeping the service rules and route contracts mostly unchanged.

## Known Limitations

- State is lost when the backend restarts.
- There is only one event.
- There is no authentication or account system.
- There is no background expiry scheduler; expiry is checked during operations.
- The waitlist has no manual management or notification delivery system.
- Server-log notifications are not a durable notification service.
- The concurrency lock protects one Node.js process only.
- The frontend has no separate management history or administrative screens.
- The API has no database persistence, distributed locking, or production deployment configuration.
