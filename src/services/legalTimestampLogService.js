'use strict';

const crypto = require('crypto');
const { LegalTimestampLog } = require('../models');

function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

function hashPayload(payload) {
  const canonical_json = JSON.stringify(canonicalize(payload));
  return {
    canonical_json,
    content_hash: crypto.createHash('sha256').update(canonical_json, 'utf8').digest('hex'),
  };
}

/**
 * 5651 için hazır, henüz zaman damgası vurulmamış yasal kayıt.
 * timestamp_token / timestamped_at sonra TSA ile doldurulacak.
 */
async function record({
  tenantId,
  schoolId = null,
  requestId = null,
  eventType,
  payload,
  actor = {},
  transaction = null,
}) {
  const { canonical_json, content_hash } = hashPayload(payload);
  return LegalTimestampLog.create(
    {
      tenant_id: tenantId,
      school_id: schoolId || null,
      request_id: requestId || null,
      event_type: eventType,
      actor_user_id: actor.userId || null,
      actor_name: actor.name || null,
      actor_email: actor.email || null,
      payload,
      canonical_json,
      content_hash,
      hash_algorithm: 'SHA-256',
      timestamp_status: 'pending',
      ip: actor.ip || null,
      user_agent: actor.userAgent ? String(actor.userAgent).slice(0, 400) : null,
    },
    { transaction },
  );
}

module.exports = { canonicalize, hashPayload, record };
