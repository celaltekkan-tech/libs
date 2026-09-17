'use strict';

const { MessageLog } = require('../models');

function truncate(str, max) {
  if (typeof str !== 'string') return str;
  return str.length > max ? str.slice(0, max) : str;
}

/**
 * Sistem tarafından gönderilen SMS/e-postaları kalıcı olarak loglar. Hata
 * durumunda ana gönderim akışını bozmaz (auditService.log ile aynı desen).
 * Not: OTP/2FA gönderimleri (smsLoginService) bilinçli olarak bu logu
 * çağırmaz — güvenlik amacıyla kayıt altına alınmaz.
 */
async function record({
  tenantId,
  channel,
  sourceModule,
  sourceId = null,
  recipientLabel = null,
  recipientContact = null,
  subject = null,
  body = null,
  status,
  error = null,
  sentAt = null,
}) {
  try {
    if (!tenantId) return;
    await MessageLog.create({
      tenant_id: tenantId,
      channel,
      source_module: sourceModule,
      source_id: sourceId,
      recipient_label: recipientLabel ? truncate(String(recipientLabel), 150) : null,
      recipient_contact: recipientContact ? truncate(String(recipientContact), 150) : null,
      subject: subject ? truncate(String(subject), 300) : null,
      body: body || null,
      status,
      error: error || null,
      sent_at: sentAt,
    });
  } catch (err) {
    console.error('[messageLog]', err.message || err);
  }
}

module.exports = { record };
