'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_REGULAR = 'SalaryFormSans';
const FONT_BOLD = 'SalaryFormSans-Bold';

function resolveFonts() {
  const pairs = [
    ['C:\\Windows\\Fonts\\arial.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf'],
    ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
    ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'],
  ];
  for (const [regular, bold] of pairs) {
    if (fs.existsSync(regular) && fs.existsSync(bold)) {
      return { regular, bold };
    }
  }
  return null;
}

function text(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function padRows(rows, minCount) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  while (list.length < minCount) list.push({});
  return list;
}

/**
 * Resmî forma yakın, yazdırılabilir PDF üretir.
 * @param {object} model buildSalaryFormModel çıktısı
 * @returns {Promise<Buffer>}
 */
function buildSalaryChangePdf(model) {
  return new Promise((resolve, reject) => {
    const fonts = resolveFonts();
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 18, bottom: 18, left: 18, right: 18 },
      info: {
        Title: 'Maaş Değişikliği Bildirim Formu',
        Author: 'Norm Kadro',
      },
    });

    if (fonts) {
      doc.registerFont(FONT_REGULAR, fonts.regular);
      doc.registerFont(FONT_BOLD, fonts.bold);
    }

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    let y = doc.page.margins.top;

    const useBold = () => doc.font(fonts ? FONT_BOLD : 'Helvetica-Bold');
    const useReg = () => doc.font(fonts ? FONT_REGULAR : 'Helvetica');

    const drawBox = (x, boxY, w, h) => {
      doc.rect(x, boxY, w, h).stroke();
    };

    const cell = (x, boxY, w, h, value, opts = {}) => {
      drawBox(x, boxY, w, h);
      const pad = 2;
      if (opts.bold) useBold();
      else useReg();
      doc.fontSize(opts.size || 7);
      doc.text(text(value), x + pad, boxY + pad, {
        width: w - pad * 2,
        height: h - pad * 2,
        align: opts.align || 'center',
        valign: 'center',
        ellipsis: true,
      });
    };

    const sectionTitle = (label, h = 16) => {
      cell(left, y, pageW, h, label, { bold: true, size: 8, align: 'left' });
      y += h;
    };

    const header = model.header || {};

    // Başlık
    cell(left, y, pageW, 22, 'MAAŞ DEĞİŞİKLİĞİ BİLDİRİM FORMU', { bold: true, size: 12 });
    y += 22;

    // Kurum / ay
    const c1 = pageW * 0.18;
    const c2 = pageW * 0.42;
    const c3 = pageW * 0.18;
    const c4 = pageW * 0.11;
    const c5 = pageW * 0.11;
    cell(left, y, c1, 16, 'KURUMUN ADI', { bold: true, size: 8 });
    cell(left + c1, y, c2, 16, header.institution_name, { bold: true, size: 8 });
    cell(left + c1 + c2, y, c3, 16, 'İLGİLİ AY - YIL', { bold: true, size: 8 });
    cell(left + c1 + c2 + c3, y, c4, 16, header.month_name, { bold: true, size: 9 });
    cell(left + c1 + c2 + c3 + c4, y, c5, 16, header.year, { bold: true, size: 9 });
    y += 16;

    cell(left, y, c1, 16, 'BANKA ŞUBESİ', { bold: true, size: 8 });
    cell(left + c1, y, c2 + c3 + c4 + c5, 16, header.bank_branch, { bold: true, size: 8 });
    y += 16;

    // A) mevcut personel
    const aLeft = pageW * 0.62;
    cell(left, y, aLeft, 16, 'A) MEVCUT PERSONEL SAYISI :(Bu ay içinde görevde olanlar)', {
      bold: true,
      size: 8,
      align: 'left',
    });
    cell(left + aLeft, y, pageW * 0.22, 16, 'Okulun Saymanlık Kodu', { bold: true, size: 7 });
    cell(left + aLeft + pageW * 0.22, y, pageW * 0.16, 16, header.accounting_code, { bold: true, size: 9 });
    y += 16;

    const countCols = [
      ['GEÇEN AY PERSONEL SAYISI', header.previous_month],
      ['BU AY İÇİNDE GİREN PERSONEL SAYISI', header.started],
      ['BU AY İÇİNDE ÇIKAN PERSONEL SAYISI', header.left],
      ['BU AY ÖDEME YAPILACAK PERSONEL SAYISI', header.payable],
    ];
    const cw = pageW / countCols.length;
    countCols.forEach(([label], i) => {
      cell(left + i * cw, y, cw * 0.65, 28, label, { size: 6 });
      cell(left + i * cw + cw * 0.65, y, cw * 0.35, 28, countCols[i][1], { bold: true, size: 14 });
    });
    y += 30;

    const drawTable = (title, columns, rows, minRows, hint) => {
      if (y > doc.page.height - 90) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      sectionTitle(title, 15);
      const widths = columns.map((c) => c.w * pageW);
      const headerH = 18;
      let x = left;
      columns.forEach((col, i) => {
        cell(x, y, widths[i], headerH, col.label, { bold: true, size: 6.5 });
        x += widths[i];
      });
      y += headerH;

      const body = padRows(rows, minRows);
      const rowH = 14;
      body.forEach((row) => {
        if (y > doc.page.height - 40) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        x = left;
        columns.forEach((col, i) => {
          const value = i === columns.length - 1 && hint && !text(row[col.key]) ? hint : row[col.key];
          cell(x, y, widths[i], rowH, value, { size: 7, align: col.align || 'center' });
          x += widths[i];
        });
        y += rowH;
      });
      y += 6;
    };

    drawTable(
      'B) AYRILAN PERSONELİN:(Geçen ay bordroda olup bu ay maaş bordrosunda girmeyecek ayrılan, aylıksız izinli personel)',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.1 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.22 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.14 },
        { key: 'leave_date', label: 'Görevden Ayrıldığı Tarih', w: 0.14 },
        { key: 'leave_reason', label: 'Ayrılma Nedeni', w: 0.18 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.22 },
      ],
      model.departures,
      3,
      '(Kararname, Ayrılış yazısı, Maaş Nakil...)',
    );

    drawTable(
      'C) BAŞLAYAN PERSONELİN: (Bu ay ilk defa maaş bordrosuna girecek yeni gelen veya aylıksız izinden dönen personel)',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.09 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.16 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.12 },
        { key: 'iban', label: 'İban Numarası', w: 0.2 },
        { key: 'start_reason', label: 'Başlama Nedeni', w: 0.12 },
        { key: 'start_date', label: 'Başlama Tarihi', w: 0.11 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.2 },
      ],
      model.starters,
      3,
      '(Kararname, Maaş Nakil, Göreve Başlama yazısı)',
    );

    drawTable(
      'D) TERFİİ EDECEK PERSONELİN: (Bu ay içinde İntibak, Derece ve Kademe Terfii yapılacak personel)',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.09 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.18 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.13 },
        { key: 'previous_degree', label: 'Eski Derece', w: 0.08 },
        { key: 'previous_rank', label: 'Eski Kademe', w: 0.08 },
        { key: 'new_degree', label: 'Yeni Derece', w: 0.08 },
        { key: 'new_rank', label: 'Yeni Kademe', w: 0.08 },
        { key: 'promotion_date', label: 'Terfi Tarihi', w: 0.1 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.18 },
      ],
      model.promotions,
      4,
      'Terfii Onayı',
    );

    drawTable(
      'E) MAAŞ DEĞİŞİKLİĞİ YAPILACAK PERSONELİN',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.1 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.2 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.14 },
        { key: 'previous_status', label: 'Önceki Durumu', w: 0.18 },
        { key: 'new_status', label: 'Yeni Durumu', w: 0.18 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.2 },
      ],
      model.other_changes,
      2,
    );

    drawTable(
      'F) KESİNTİLER',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.1 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.2 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.14 },
        { key: 'reason', label: 'Kesinti Nedeni', w: 0.22 },
        { key: 'amount', label: 'Miktar', w: 0.12 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.22 },
      ],
      model.deductions,
      2,
    );

    drawTable(
      'G) RAPORLU GÜN',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.1 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.2 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.14 },
        { key: 'start_date', label: 'Başlama Tarihi', w: 0.14 },
        { key: 'days_after_7', label: '7 Günden Sonra Gün', w: 0.18 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.24 },
      ],
      model.report_days,
      2,
      'sağlık raporları',
    );

    drawTable(
      'H) SENDİKA DEĞİŞİKLİĞİ',
      [
        { key: 'personnel_no', label: 'Personel No', w: 0.1 },
        { key: 'full_name', label: 'Adı Soyadı', w: 0.2 },
        { key: 'national_id', label: 'T.C. Numarası', w: 0.14 },
        { key: 'left_union', label: 'Ayrıldığı Sendika', w: 0.18 },
        { key: 'joined_union', label: 'Girdiği Sendika', w: 0.18 },
        { key: 'documents', label: 'Eklenecek Belgeler', w: 0.2 },
      ],
      model.union_changes,
      2,
      '(Sendika giriş ve çıkış formları)',
    );

    // İmza
    if (y > doc.page.height - 70) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const noteW = pageW * 0.62;
    const signW = pageW * 0.38;
    cell(
      left,
      y,
      noteW,
      42,
      "Maaş değişiklik formları her ayın 1' inde bütçe bürosuna elden teslim edilecektir.",
      { size: 7, align: 'left' },
    );
    cell(left + noteW, y, signW, 14, text(header.form_date), { size: 8 });
    cell(left + noteW, y + 14, signW, 14, 'Düzenleyen', { bold: true, size: 7 });
    cell(left + noteW, y + 28, signW, 14, header.principal, { size: 8 });
    y += 42;
    cell(left + noteW, y, signW, 14, 'Okul Müdürü', { bold: true, size: 7 });

    doc.end();
  });
}

module.exports = {
  buildSalaryChangePdf,
  resolveFonts,
};
