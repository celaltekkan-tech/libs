'use strict';

const APP_NAME = process.env.MAIL_APP_NAME || 'Okul İdare Sistemi';
const VENDOR_NAME = process.env.MAIL_VENDOR_NAME || '';
const DEFAULT_LOGO_URL = process.env.MAIL_LOGO_URL || '';
const PRIVACY_URL = process.env.MAIL_PRIVACY_URL || '';
const SUPPORT_URL = process.env.MAIL_SUPPORT_URL || '';
const PRIMARY = '#1E3A8A';
const TEXT = '#1F2937';
const MUTED = '#6B7280';
const FAINT = '#9CA3AF';
const CODE_BG = '#F3F5FB';
const BORDER = '#E5E7EB';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function spacedCode(code) {
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return String(code || '');
}

function makeInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Oİ';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toLocaleUpperCase('tr-TR');
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function footerLink(label, url) {
  const safe = escapeHtml(label);
  if (!isHttpUrl(url)) {
    return `<span style="color:${FAINT};">${safe}</span>`;
  }
  return `<a href="${escapeHtml(url.trim())}" style="color:${FAINT};text-decoration:underline;">${safe}</a>`;
}

function buildLogoHtml({ logoUrl, logoCid, schoolName }) {
  const alt = escapeHtml(schoolName || APP_NAME);
  if (logoCid) {
    return `<img src="cid:${escapeHtml(logoCid)}" alt="${alt}" width="72" style="display:block;margin:0 auto;border:0;max-width:72px;height:auto;" />`;
  }
  if (isHttpUrl(logoUrl)) {
    return `<img src="${escapeHtml(logoUrl.trim())}" alt="${alt}" width="72" style="display:block;margin:0 auto;border:0;max-width:72px;height:auto;" />`;
  }
  const initials = escapeHtml(makeInitials(schoolName || APP_NAME));
  return `<div style="width:64px;height:64px;margin:0 auto;border-radius:16px;background:${PRIMARY};color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.04em;line-height:64px;text-align:center;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">${initials}</div>`;
}

function buildTeacherRegisterVerificationEmail({
  fullName,
  code,
  minutes,
  schoolName,
  logoUrl,
  logoCid,
} = {}) {
  const name = String(fullName || 'öğretmen').trim() || 'öğretmen';
  const school = String(schoolName || '').trim();
  const safeName = escapeHtml(name);
  const safeSchool = escapeHtml(school);
  const displayCode = escapeHtml(spacedCode(code));
  const ttl = Number(minutes) || 10;
  const year = new Date().getFullYear();
  const logo = buildLogoHtml({
    logoCid,
    logoUrl: logoUrl || DEFAULT_LOGO_URL,
    schoolName: school || APP_NAME,
  });
  const subject = school
    ? `${school} — Öğretmen kaydınızı tamamlayın`
    : `${APP_NAME} — Öğretmen kaydınızı tamamlayın`;

  const text = [
    school ? `${school}` : null,
    APP_NAME,
    '',
    'Öğretmen kaydınızı tamamlayın',
    '',
    `Merhaba ${name},`,
    '',
    'Mobil uygulama üzerinden oluşturduğunuz öğretmen kaydını tamamlamak için aşağıdaki doğrulama kodunu uygulamadaki ilgili alana girin.',
    '',
    `Doğrulama kodunuz: ${code}`,
    `Bu kod ${ttl} dakika boyunca geçerlidir.`,
    '',
    'Güvenliğiniz için: İlk girişinizde geçici şifrenizi değiştirmenizi öneririz.',
    'Bu doğrulama kodunu yalnızca Okul İdare Sistemi içerisindeki doğrulama ekranında kullanın. Kodunuzu üçüncü kişilerle paylaşmayın. Bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayabilirsiniz.',
    '',
    APP_NAME,
    'Bu e-posta otomatik olarak gönderilmiştir. Lütfen bu e-postaya yanıt vermeyiniz.',
    VENDOR_NAME ? `Powered by ${VENDOR_NAME}` : null,
    `© ${year} ${APP_NAME}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:10px;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border:1px solid #B8C4DF;">
                <tr>
                  <td style="padding:3px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border:1px solid #D7DEEE;">
                      <tr>
                        <td align="center" style="padding:28px 24px 20px;background:#ffffff;">
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
                        <td style="padding:0 24px;">
                          <div style="border-top:1px solid ${BORDER};"></div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:26px 24px;">
                          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.35;font-weight:700;color:${TEXT};">Öğretmen kaydınızı tamamlayın</h1>
                          <p style="margin:0 0 10px;font-size:16px;line-height:1.5;color:${TEXT};">Merhaba ${safeName},</p>
                          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${MUTED};">
                            Mobil uygulama üzerinden oluşturduğunuz öğretmen kaydını tamamlamak için aşağıdaki doğrulama kodunu uygulamadaki ilgili alana girin.
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td align="center" style="background:${CODE_BG};border:1px solid #D9E0F2;border-radius:12px;padding:22px 16px;">
                                <div style="font-size:11px;color:${PRIMARY};letter-spacing:.18em;text-transform:uppercase;font-weight:700;">Doğrulama kodunuz</div>
                                <div style="margin:12px 0;font-size:38px;letter-spacing:.42em;font-weight:700;color:${PRIMARY};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding-left:.42em;">${displayCode}</div>
                                <div style="font-size:13px;color:${MUTED};">Bu kod ${ttl} dakika boyunca geçerlidir.</div>
                              </td>
                            </tr>
                          </table>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                            <tr>
                              <td style="padding:16px 8px 4px;">
                                <div style="font-size:13px;font-weight:700;color:${TEXT};letter-spacing:.02em;">Güvenliğiniz için</div>
                                <p style="margin:8px 0 0;font-size:13px;line-height:1.65;color:${MUTED};">
                                  İlk girişinizde geçici şifrenizi değiştirmenizi öneririz.
                                </p>
                                <p style="margin:10px 0 0;font-size:13px;line-height:1.65;color:${MUTED};">
                                  Bu doğrulama kodunu yalnızca ${escapeHtml(APP_NAME)} içerisindeki doğrulama ekranında kullanın. Kodunuzu üçüncü kişilerle paylaşmayın. Bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayabilirsiniz.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 24px;">
                          <div style="border-top:1px solid ${BORDER};"></div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:20px 24px 24px;">
                          <div style="font-size:13px;font-weight:700;color:${TEXT};">${escapeHtml(APP_NAME)}</div>
                          <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${FAINT};">
                            Bu e-posta otomatik olarak gönderilmiştir. Lütfen bu e-postaya yanıt vermeyiniz.
                          </p>
                          <p style="margin:12px 0 0;font-size:12px;color:${FAINT};">
                            ${footerLink('Gizlilik Politikası', PRIVACY_URL)}
                            &nbsp;·&nbsp;
                            ${footerLink('Destek', SUPPORT_URL)}
                          </p>
                          <p style="margin:12px 0 0;font-size:11px;color:${FAINT};">© ${year} ${escapeHtml(APP_NAME)}</p>
                          ${
                            VENDOR_NAME
                              ? `<p style="margin:8px 0 0;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:${FAINT};">Powered by ${escapeHtml(VENDOR_NAME)}</p>`
                              : ''
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

module.exports = {
  APP_NAME,
  DEFAULT_LOGO_URL,
  escapeHtml,
  buildLogoHtml,
  buildTeacherRegisterVerificationEmail,
};
