const { Op } = require('sequelize');
const { User } = require('../models');

const ONLINE_WINDOW_MS = 90 * 1000;
const WRITE_GAP_MS = 20 * 1000;

const lastWrite = new Map();

async function touch(userId) {
  if (!userId) return;
  const now = Date.now();
  const prev = lastWrite.get(userId) || 0;
  if (now - prev < WRITE_GAP_MS) return;
  lastWrite.set(userId, now);
  await User.update(
    { last_seen_at: new Date(now) },
    { where: { id: userId, is_active: true } },
  );
}

function noteWrite(userId) {
  if (!userId) return;
  lastWrite.set(userId, Date.now());
}

async function clear(userId) {
  if (!userId) return;
  lastWrite.delete(userId);
  await User.update({ last_seen_at: null }, { where: { id: userId } });
}

async function summary() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const rows = await User.findAll({
    attributes: ['tenant_id'],
    where: {
      is_active: true,
      is_platform_admin: false,
      last_seen_at: { [Op.gte]: since },
    },
    raw: true,
  });
  const tenants = new Set(rows.map((row) => row.tenant_id));
  return {
    online_tenants: tenants.size,
    online_users: rows.length,
  };
}

module.exports = {
  ONLINE_WINDOW_MS,
  touch,
  noteWrite,
  clear,
  summary,
};
