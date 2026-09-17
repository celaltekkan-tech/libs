'use strict';

const EMAIL_STATUS = {
  SUCCESS: 'basarili',
  FAILED: 'basarisiz',
  CANCELLED: 'iptal',
};

class EmailConfigError extends Error {}

function truncate(str, max = 500) {
  if (typeof str !== 'string') return str;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

/**
 * @returns {Promise<{status: string, messageId: string|null, error: string|null}>}
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to || !String(to).trim()) {
    return { status: EMAIL_STATUS.CANCELLED, messageId: null, error: 'Alıcı e-posta yok' };
  }
  if (!subject || !String(subject).trim()) {
    return { status: EMAIL_STATUS.CANCELLED, messageId: null, error: 'Konu boş' };
  }
  if (!isConfigured()) {
    throw new EmailConfigError('SMTP yapılandırması eksik (SMTP_HOST, SMTP_FROM gerekli)');
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new EmailConfigError('nodemailer paketi yüklü değil');
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: String(to).trim(),
      subject: String(subject).trim(),
      text: text || undefined,
      html: html || undefined,
    });
    return {
      status: EMAIL_STATUS.SUCCESS,
      messageId: info.messageId || null,
      error: null,
    };
  } catch (err) {
    return {
      status: EMAIL_STATUS.FAILED,
      messageId: null,
      error: truncate(err.message),
    };
  }
}

module.exports = {
  sendEmail,
  EMAIL_STATUS,
  EmailConfigError,
  isConfigured,
};
