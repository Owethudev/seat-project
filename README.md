# Ticket Reservation System

This project is a ticket reservation system. It contains a Node.js and Express API in `backend/` and a placeholder `frontend/` directory for future frontend work.

## Backend setup

Open a terminal in the `backend/` directory and install the dependencies:

```bash
npm install
```

## Start the backend

For normal startup:

```bash
npm start
```

For development with Node.js file watching:

```bash
npm run dev
```

The API runs on `http://localhost:3000` by default.

## Health check

With the backend running, request:

```text
GET http://localhost:3000/api/health
```

The response is:

```json
{
  "status": "ok"
}
```

## Current configuration

- Seats per event: `20`
- Hold expiry: `60` seconds
- Maximum active holds per user: `2`
- Maximum holds per user per hour: `5`
- Maximum extensions per hold: `2`

These values are kept in `backend/src/config/config.js` so they can be changed in one place.

This is Phase 1. Reservation functionality and other system features will be added in later phases.
