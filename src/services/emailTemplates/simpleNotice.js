'use strict';

const {
  APP_NAME,
  DEFAULT_LOGO_URL,
  escapeHtml,
  buildLogoHtml,
} = require('./teacherRegisterVerification');

const PRIMARY = '#1E3A8A';
const TEXT = '#1F2937';
const MUTED = '#6B7280';
const FAINT = '#9CA3AF';
const BORDER = '#E5E7EB';

function buildSimpleNoticeEmail({ title, body, schoolName, logoUrl, logoCid } = {}) {
  const school = String(schoolName || '').trim();
  const safeTitle = escapeHtml(title || APP_NAME);
  const safeBody = escapeHtml(body || '')
    .replace(/\n/g, '<br />');
  const safeSchool = escapeHtml(school);
  const year = new Date().getFullYear();
  const logo = buildLogoHtml({
    logoCid,
    logoUrl: logoUrl || DEFAULT_LOGO_URL,
    schoolName: school || APP_NAME,
  });

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td align="center" style="padding:28px 24px 20px;">
              ${logo}
              ${
                school
                  ? `<div style="margin-top:14px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${PRIMARY};font-weight:700;">${safeSchool}</div>`
                  : ''
              }
              <div style="margin-top:${school ? '6' : '14'}px;font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:${PRIMARY};font-weight:600;">${escapeHtml(APP_NAME)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;"><div style="border-top:1px solid ${BORDER};"></div></td>
          </tr>
          <tr>
            <td style="padding:26px 24px;">
              <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:700;color:${TEXT};">${safeTitle}</h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:${MUTED};">${safeBody}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;"><div style="border-top:1px solid ${BORDER};"></div></td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 24px 24px;">
              <div style="font-size:13px;font-weight:700;color:${TEXT};">${escapeHtml(APP_NAME)}</div>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${FAINT};">Bu e-posta otomatik olarak gönderilmiştir.</p>
              <p style="margin:12px 0 0;font-size:11px;color:${FAINT};">© ${year} ${escapeHtml(APP_NAME)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: String(title || APP_NAME), html };
}

module.exports = { buildSimpleNoticeEmail };
