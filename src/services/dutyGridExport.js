'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { registerUnicodeFonts } = require('../utils/pdfFonts');

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function paintCell(cell, { bold = false, center = true } = {}) {
  cell.border = BORDER;
  cell.alignment = { wrapText: true, vertical: 'middle', horizontal: center ? 'center' : 'left' };
  cell.font = { name: 'Calibri', size: 11, bold, color: { argb: 'FF000000' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
}

async function sendDutyGrid(res, { format, title, locations, days, rules }) {
  const headers = ['Gün', ...locations.map((location) => location.name)];
  const body = days.map((day) => [day.label, ...day.cells]);

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Nöbet');
    sheet.addRow([title]);
    sheet.mergeCells(1, 1, 1, headers.length);
    paintCell(sheet.getCell(1, 1), { bold: true });
    let rowIndex = 2;
    if (rules) {
      sheet.addRow([`Açıklama: ${rules}`]);
      sheet.mergeCells(rowIndex, 1, rowIndex, headers.length);
      paintCell(sheet.getCell(rowIndex, 1), { center: false });
      rowIndex += 1;
    }
    sheet.addRow(headers);
    headers.forEach((_, index) => paintCell(sheet.getRow(rowIndex).getCell(index + 1), { bold: true }));
    body.forEach((line) => {
      const row = sheet.addRow(line);
      line.forEach((_, index) => paintCell(row.getCell(index + 1), { center: index !== 0 }));
      row.height = 32;
    });
    sheet.getColumn(1).width = 22;
    for (let index = 2; index <= headers.length; index += 1) sheet.getColumn(index).width = 18;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="nobet-cizelgesi.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (format === 'csv') {
    const escape = (value) => {
      const text = value == null ? '' : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [headers, ...body].map((line) => line.map(escape).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nobet-cizelgesi.csv"');
    return res.send(`\uFEFF${lines.join('\r\n')}`);
  }

  const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
  const fonts = registerUnicodeFonts(doc);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="nobet-cizelgesi.pdf"');
  doc.pipe(res);
  doc.font(fonts.bold).fontSize(14).fillColor('#000000').text(title, { align: 'center' });
  if (rules) {
    doc.moveDown(0.4);
    doc.font(fonts.regular).fontSize(9).text(rules, { align: 'left' });
  }
  doc.moveDown(0.6);

  const tableWidth = 780;
  const colCount = Math.max(headers.length, 1);
  const firstWidth = 110;
  const otherWidth = Math.max(48, (tableWidth - firstWidth) / Math.max(colCount - 1, 1));
  const widths = headers.map((_, index) => (index === 0 ? firstWidth : otherWidth));
  let y = doc.y;

  const drawRow = (cells, bold, height) => {
    if (y + height > 540) {
      doc.addPage();
      y = 36;
    }
    let x = 28;
    cells.forEach((value, index) => {
      const width = widths[index];
      doc.lineWidth(0.6).strokeColor('#000000').rect(x, y, width, height).stroke();
      doc.font(bold ? fonts.bold : fonts.regular).fontSize(8).fillColor('#000000');
      doc.text(String(value || ''), x + 3, y + 4, { width: width - 6, height: height - 6, align: index === 0 ? 'left' : 'center' });
      x += width;
    });
    y += height;
  };

  drawRow(headers, true, 22);
  body.forEach((line) => drawRow(line, false, 36));
  doc.end();
  return undefined;
}

module.exports = { sendDutyGrid };
