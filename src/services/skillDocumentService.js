'use strict';

const ExcelJS = require('exceljs');

const MONTHS = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function sheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.addRow(columns);
  ws.getRow(1).font = { bold: true };
  for (const row of rows) ws.addRow(row);
  columns.forEach((title, index) => {
    ws.getColumn(index + 1).width = Math.min(36, Math.max(14, String(title).length + 4));
  });
  return ws;
}

async function workbookBuffer(kind, data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Okul İdare';
  if (kind === 'sozlesme') {
    const p = data.placement;
    sheet(wb, 'Sözleşme', ['Alan', 'Bilgi'], [
      ['Okul', data.schoolName || ''],
      ['Öğrenci', p.studentName],
      ['T.C. / öğrenci no', p.identity],
      ['Sınıf', p.classLabel],
      ['İşletme', p.businessName],
      ['Vergi no', p.taxNo],
      ['SGK işyeri sicil no', p.sgkNo],
      ['İşletme adresi', p.address],
      ['Usta öğretici', p.masterName],
      ['İşletme yetkilisi', p.contactName],
      ['Koordinatör öğretmen', p.teacherName],
      ['Eğitim öğretim yılı', p.academicYear],
      ['Başlangıç', p.startDate],
      ['Bitiş', p.endDate],
      ['Haftalık gün', p.weeklyDays],
      ['Sözleşme no', p.contractNo],
      ['Sözleşme tarihi', p.contractDate],
      ['Durum', p.statusLabel],
      ['Not', p.note],
    ]);
  } else if (kind === 'devam') {
    const days = Array.from({ length: data.dayCount }, (_, i) => String(i + 1));
    sheet(
      wb,
      'Devam',
      ['Öğrenci', 'Sınıf', 'İşletme', 'Usta öğretici', ...days, 'Geldiği gün', 'Devamsızlık'],
      data.rows
    );
  } else if (kind === 'destek') {
    sheet(
      wb,
      'Devlet katkısı',
      ['Ay', 'Öğrenci', 'Sınıf', 'İşletme', 'SGK işyeri', 'Çalıştığı gün', 'Tutar', 'Durum', 'Ödeme tarihi', 'Not'],
      data.rows
    );
  } else {
    sheet(
      wb,
      'SGK',
      ['Öğrenci', 'T.C.', 'Sınıf', 'İşletme', 'SGK işyeri sicil', 'Bildirim', 'Tarih', 'SGK referans', 'Durum', 'Not'],
      data.rows
    );
  }
  return wb.xlsx.writeBuffer();
}

function monthName(month) {
  return MONTHS[month] || String(month);
}

module.exports = { workbookBuffer, monthName };
