const crypto = require('node:crypto');

const allowedCharacters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const holdCodeLength = 6;

function generateHoldCode() {
  let holdCode = '';

  for (let index = 0; index < holdCodeLength; index += 1) {
    const characterIndex = crypto.randomInt(allowedCharacters.length);
    holdCode += allowedCharacters[characterIndex];
  }

  return holdCode;
}

module.exports = {
  generateHoldCode
};
