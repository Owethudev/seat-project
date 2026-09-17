const config = {
  port: 3000,
  seatsPerEvent: 20,
  holdExpirySeconds: 60,
  maxActiveHoldsPerUser: 2,
  maxHoldsPerHourPerUser: 5,
  maxExtensionsPerHold: 2
};

module.exports = config;
