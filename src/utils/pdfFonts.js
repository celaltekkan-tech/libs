'use strict';

const fs = require('fs');

const FONT_REGULAR = 'AppUnicodeSans';
const FONT_BOLD = 'AppUnicodeSans-Bold';

const FONT_PAIRS = [
  ['C:\\Windows\\Fonts\\arial.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf'],
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
  ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'],
];

function resolveFontPaths() {
  for (const [regular, bold] of FONT_PAIRS) {
    if (fs.existsSync(regular) && fs.existsSync(bold)) {
      return { regular, bold };
    }
  }
  return null;
}

/**
 * PDFKit'in standart Helvetica fontu Türkçe karakterleri (İ, ı, ğ, ş, ç, ö, ü)
 * doğru basamaz. Sistemde bulunan bir Unicode TTF fontu kaydedip isimlerini döner;
 * bulunamazsa Helvetica'ya düşer (karakterler yine bozuk olur ama uygulama kırılmaz).
 * @param {import('pdfkit')} doc
 * @returns {{ regular: string, bold: string }}
 */
function registerUnicodeFonts(doc) {
  const fonts = resolveFontPaths();
  if (!fonts) {
    return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
  }
  doc.registerFont(FONT_REGULAR, fonts.regular);
  doc.registerFont(FONT_BOLD, fonts.bold);
  return { regular: FONT_REGULAR, bold: FONT_BOLD };
}

module.exports = { registerUnicodeFonts };
