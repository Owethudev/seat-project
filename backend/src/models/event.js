function createSeat(seatNumber) {
  return {
    number: seatNumber,
    status: 'available'
  };
}

function createEvent(seatsPerEvent) {
  const seats = [];

  for (let seatNumber = 1; seatNumber <= seatsPerEvent; seatNumber += 1) {
    seats.push(createSeat(seatNumber));
  }

  return {
    seats,
    holdHistory: [],
    usedHoldCodes: []
  };
}

module.exports = {
  createEvent
};
