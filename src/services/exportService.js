'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Tabloyu xlsx / csv / pdf olarak response'a yazar.
 * @param {import('express').Response} res
 * @param {{
 *   format: 'xlsx'|'csv'|'pdf',
 *   filename: string,
 *   title: string,
 *   headers: string[],
 *   rows: Array<Array<string|number|null|undefined>>,
 * }} opts
 */
async function sendTableExport(res, { format, filename, title, headers, rows }) {
  const base = filename.replace(/\.[^.]+$/, '');

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.slice(0, 31) || 'Liste');
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row.map((v) => (v == null ? '' : v))));
    sheet.getRow(1).font = { bold: true };
    headers.forEach((_, idx) => {
      sheet.getColumn(idx + 1).width = 18;
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (format === 'csv') {
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map((cell) => escapeCsvCell(cell == null ? '' : cell)).join(',')),
    ];
    // Excel TR uyumu için UTF-8 BOM
    const body = `\uFEFF${lines.join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
    return res.send(body);
  }

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
  doc.pipe(res);

  doc.fontSize(14).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(9);

  const colWidth = Math.max(40, Math.floor(740 / Math.max(headers.length, 1)));
  let y = doc.y;
  let x = 40;
  headers.forEach((header) => {
    doc.text(header, x, y, { width: colWidth - 4, continued: false });
    x += colWidth;
  });
  y += 18;
  doc.moveTo(40, y - 4).lineTo(780, y - 4).stroke();

  rows.forEach((row) => {
    if (y > 520) {
      doc.addPage();
      y = 40;
    }
    x = 40;
    row.forEach((cell) => {
      const text = cell == null || cell === '' ? '—' : String(cell);
      doc.text(text, x, y, { width: colWidth - 4, ellipsis: true });
      x += colWidth;
    });
    y += 16;
  });

  doc.end();
}

module.exports = { sendTableExport };
