'use strict';

const crypto = require('crypto');

const SCHOOL_CODE_PATTERN = /^\d{6}$/;
const SCHOOL_CODE_MESSAGE = 'Okul kodu 6 haneli sayı olmalıdır';

function isValidSchoolCode(value) {
  return typeof value === 'string' && SCHOOL_CODE_PATTERN.test(value);
}

function randomSchoolCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function generateUniqueSchoolCode(isTaken, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomSchoolCode();
    if (!(await isTaken(code))) return code;
  }
  const err = new Error('Benzersiz okul kodu üretilemedi');
  err.status = 500;
  throw err;
}

module.exports = {
  SCHOOL_CODE_PATTERN,
  SCHOOL_CODE_MESSAGE,
  isValidSchoolCode,
  randomSchoolCode,
  generateUniqueSchoolCode,
};
