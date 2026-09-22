'use strict';

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
} = require('docx');

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 2, color: '999999' };
const CELL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

function textParagraph(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, italics: !!opts.italics })],
  });
}

function labelValueParagraph(label, value, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 100 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: String(value ?? '—') }),
    ],
  });
}

function buildTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          borders: CELL_BORDERS,
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          children: [textParagraph(h, { bold: true, after: 0 })],
        })
    ),
  });
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders: CELL_BORDERS,
              width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
              children: [textParagraph(cell, { after: 0 })],
            })
        ),
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] });
}

function buildSignatureRow(signatureColumns) {
  const headers = signatureColumns.map((col) => col.label || ' ');
  const nameRow = signatureColumns.map((col) => col.name || '…………………………………');
  const titleRow = signatureColumns.map((col) => col.title || ' ');
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              borders: CELL_BORDERS,
              width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
              children: [textParagraph(h, { align: AlignmentType.CENTER, after: 0 })],
            })
        ),
      }),
      new TableRow({
        children: nameRow.map(
          (n, i) =>
            new TableCell({
              borders: CELL_BORDERS,
              children: [
                textParagraph(n, { align: AlignmentType.CENTER, after: 0 }),
                textParagraph(titleRow[i], { align: AlignmentType.CENTER, after: 0 }),
              ],
            })
        ),
      }),
    ],
  });
}

/**
 * Disiplin modülü belgeleri için genel amaçlı .docx üretici.
 * Tüm tutanak/form/tebligat şablonları bu fonksiyonu farklı verilerle çağırır.
 */
async function buildDisciplineDocx({
  schoolName,
  officialHeader,
  sayi,
  konu,
  title,
  addressee,
  infoRows,
  paragraphs,
  table,
  signatures,
  signatureColumns,
  dateLabel,
}) {
  const children = [];

  if (officialHeader) {
    children.push(textParagraph('T.C.', { align: AlignmentType.CENTER, bold: true, after: 0 }));
    children.push(
      textParagraph(`${String(schoolName || '').toUpperCase()} MÜDÜRLÜĞÜ`, {
        align: AlignmentType.CENTER,
        bold: true,
        after: 300,
      })
    );
  } else {
    children.push(
      textParagraph(String(schoolName || 'Okul Müdürlüğü').toUpperCase(), {
        align: AlignmentType.CENTER,
        bold: true,
        after: 200,
      })
    );
  }

  if (sayi || konu) {
    if (sayi) children.push(labelValueParagraph('SAYI', sayi, { after: 60 }));
    if (konu) children.push(labelValueParagraph('KONU', konu, { after: 200 }));
  }

  if (title) {
    children.push(textParagraph(title, { align: AlignmentType.CENTER, bold: true, after: 300 }));
  }

  if (addressee) {
    children.push(textParagraph(addressee, { after: 300 }));
  }

  if (Array.isArray(infoRows) && infoRows.length > 0) {
    infoRows.forEach(([label, value]) => children.push(labelValueParagraph(label, value)));
    children.push(textParagraph('', { after: 200 }));
  }

  if (Array.isArray(paragraphs)) {
    paragraphs.forEach((p) => {
      if (typeof p === 'string') {
        children.push(textParagraph(p, { align: AlignmentType.JUSTIFIED, after: 200 }));
      } else {
        children.push(
          textParagraph(p.text, { align: p.align || AlignmentType.JUSTIFIED, bold: p.bold, after: p.after ?? 200 })
        );
      }
    });
  }

  if (table && Array.isArray(table.headers) && Array.isArray(table.rows)) {
    children.push(buildTable(table.headers, table.rows));
    children.push(textParagraph('', { after: 200 }));
  }

  if (dateLabel) {
    children.push(textParagraph(dateLabel, { align: AlignmentType.RIGHT, after: 400 }));
  }

  if (Array.isArray(signatureColumns) && signatureColumns.length > 0) {
    children.push(buildSignatureRow(signatureColumns));
  } else if (Array.isArray(signatures) && signatures.length > 0) {
    signatures.forEach((s) => {
      children.push(textParagraph(s.name || '…………………………………', { align: AlignmentType.RIGHT, after: 20 }));
      if (s.label) children.push(textParagraph(s.label, { align: AlignmentType.RIGHT, after: 200 }));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { buildDisciplineDocx };
