'use strict';

const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

/**
 * Görevlendirme/Başlama/Ayrılış yazılarını .docx olarak üretir (kopyala-yapıştır ve
 * kurum antetine uyarlama için PDF yerine tercih edilir).
 * @param {{ schoolName: string, title: string, rows: Array<[string, string]>, body: string, dateLabel: string }} model
 * @returns {Promise<Buffer>}
 */
async function buildPersonnelDocumentDocx({ schoolName, title, rows, body, dateLabel }) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: String(schoolName || '').toUpperCase(), bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: title, bold: true })],
          }),
          ...rows.map(
            ([label, value]) =>
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: `${label}: `, bold: true }),
                  new TextRun({ text: String(value ?? '') }),
                ],
              }),
          ),
          new Paragraph({ text: '', spacing: { after: 300 } }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 600 },
            children: [new TextRun({ text: body })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
            children: [new TextRun({ text: `Düzenleme Tarihi: ${dateLabel}` })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Okul Müdürü' })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildPersonnelDocumentDocx };
