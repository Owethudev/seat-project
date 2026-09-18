Ticket Reservation App

This app lets a user view seats, hold a seat, confirm a hold, extend a hold, release a hold, join the waitlist, and view the event log.

It uses Node.js and Express for the backend, plain HTML, CSS, and JavaScript for the frontend, and in-memory storage for the current version.

Requirements

Install Node.js and npm on your computer.

Open the project

Open a terminal in the project folder.

Install backend dependencies

cd backend
npm install

Start the backend

npm start

The backend runs at:
http://localhost:3000

Open a second terminal

Install frontend dependencies

cd frontend
npm install

Start the frontend

npm run dev

The frontend opens at:
http://localhost:5173

Use the app

Open the frontend in your browser and use the screens:
- Seat Map
- Manage Hold
- Event Log

Run the tests

Open a terminal in the backend folder and run:

npm test

Configuration

The main settings are in:
backend/src/config/config.js

You can change values like:
- number of seats
- hold expiry time
- max active holds per user
- max holds per hour
- max extensions per hold

Example:

const config = {
  port: 3000,
  seatsPerEvent: 20,
  holdExpirySeconds: 60,
  maxActiveHoldsPerUser: 2,
  maxHoldsPerHourPerUser: 5,
  maxExtensionsPerHold: 2
};

After changing the config, restart the backend.

Stop the app

In each terminal, press Ctrl + C.

If something is not working

- make sure the backend is still running
- make sure the frontend is still running
- check that both ports are open

This version keeps everything in memory. If the backend restarts, the current seat data and event log reset.
