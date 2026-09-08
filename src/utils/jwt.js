const jwt = require('jsonwebtoken');

const DEV_SECRET = 'development_only_secret_change_me';
const secret = process.env.JWT_SECRET || DEV_SECRET;
const defaultExpiresIn = process.env.JWT_EXPIRES_IN || '8h';

if (process.env.NODE_ENV === 'production' && secret === DEV_SECRET) {
  throw new Error('Production ortamında JWT_SECRET tanımlanmadan sunucu başlatılamaz.');
}

function sign(payload, opts = {}) {
  const token = jwt.sign(payload, secret, {
    expiresIn: opts.expiresIn || defaultExpiresIn,
  });
  const { exp } = jwt.decode(token);

  return {
    token,
    expires_at: new Date(exp * 1000).toISOString(),
  };
}

function verify(token) {
  return jwt.verify(token, secret);
}

module.exports = { sign, verify };
