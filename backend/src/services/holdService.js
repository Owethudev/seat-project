const { createHold } = require('./holdCreationService');
const { createAutomaticHold } = require('./holdRecordService');
const {
  confirmHold,
  expireHolds,
  extendHold,
  getActiveHold,
  isHoldExpired,
  releaseHold
} = require('./holdLifecycleService');

module.exports = {
  confirmHold,
  createAutomaticHold,
  createHold,
  extendHold,
  expireHolds,
  getActiveHold,
  isHoldExpired,
  releaseHold
};
