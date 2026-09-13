'use strict';

const path = require('path');
const ExcelJS = require('exceljs');

const PROMOTION_FORM_TEMPLATE = path.join(__dirname, '..', 'templates', 'terfi_kademe_derece_formu.xlsx');
const SALARY_FORM_TEMPLATE = path.join(__dirname, '..', 'templates', 'maas_degisiklik_bildirim_formu.xlsx');

const SALARY_FORM_PROMOTION_ROWS = { start: 28, end: 36 };

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatDateTR(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/**
 * Bir terfi/kademe-derece kaydını FORM:1 (Kademe Terfi Formu) şablonuna doldurur.
 * @param {{previous_degree, previous_rank, previous_degree_rank_date, new_degree, new_rank, new_degree_rank_date, note}} history
 * @param {object} teacher Sequelize Teacher instance
 * @returns {Promise<Buffer>}
 */
async function fillPromotionForm(history, teacher) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PROMOTION_FORM_TEMPLATE);
  const ws = wb.worksheets[0];

  ws.getCell('G1').value = formatDateTR(history.new_degree_rank_date);
  ws.getCell('B3').value = teacher.city || '';
  ws.getCell('E3').value = teacher.district || '';

  ws.getCell('A14').value = teacher.personnel_no || '';
  ws.getCell('B14').value = teacher.national_id || '';
  ws.getCell('C14').value = `${teacher.first_name} ${teacher.last_name}`;
  ws.getCell('D14').value = teacher.last_graduated_school || '';
  ws.getCell('E14').value = teacher.class_level || '';
  ws.getCell('F14').value = teacher.title_branch || '';
  ws.getCell('G14').value = teacher.working_institution || '';

  ws.getCell('H14').value = history.previous_degree || '';
  ws.getCell('I14').value = teacher.pension_degree || '';
  ws.getCell('J14').value = history.previous_rank || '';
  ws.getCell('K14').value = formatDateTR(history.previous_degree_rank_date);

  ws.getCell('L14').value = history.new_degree || '';
  ws.getCell('M14').value = teacher.pension_degree || '';
  ws.getCell('N14').value = history.new_rank || '';
  ws.getCell('O14').value = formatDateTR(history.new_degree_rank_date);

  if (history.note) ws.getCell('P14').value = history.note;

  ws.getCell('M18').value = teacher.school_principal || '';

  return wb.xlsx.writeBuffer();
}

/**
 * Bir aya ait onaylanmış terfi kayıtlarını Maaş Değişikliği Bildirim Formu'nun
 * "D) Terfi Edecek Personelin" bölümüne satır satır işler. Formun geri kalanı
 * (banka şubesi, saymanlık kodu, personel sayıları, diğer bölümler) elimizde
 * veri olmadığından şablondaki haliyle bırakılır.
 * @param {Array<{history: object, teacher: object}>} entries
 * @param {{ month: number, year: number, institutionName?: string }} period
 * @returns {Promise<{ buffer: Buffer, truncated: boolean }>}
 */
async function fillSalaryChangeForm(entries, period) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SALARY_FORM_TEMPLATE);
  const ws = wb.worksheets[0];

  if (period.institutionName) ws.getCell('C3').value = period.institutionName;
  ws.getCell('I3').value = MONTH_NAMES_TR[period.month - 1] || '';
  ws.getCell('J3').value = String(period.year);
  ws.getCell('I77').value = formatDateTR(new Date());

  const principal = entries.find((e) => e.teacher.school_principal)?.teacher.school_principal;
  if (principal) ws.getCell('I79').value = principal;

  const capacity = SALARY_FORM_PROMOTION_ROWS.end - SALARY_FORM_PROMOTION_ROWS.start + 1;
  const truncated = entries.length > capacity;
  const toWrite = entries.slice(0, capacity);

  toWrite.forEach(({ history, teacher }, idx) => {
    const row = SALARY_FORM_PROMOTION_ROWS.start + idx;
    ws.getCell(`A${row}`).value = teacher.personnel_no || '';
    ws.getCell(`B${row}`).value = `${teacher.first_name} ${teacher.last_name}`;
    ws.getCell(`D${row}`).value = teacher.national_id || '';
    ws.getCell(`E${row}`).value = history.previous_degree || '';
    ws.getCell(`F${row}`).value = history.previous_rank || '';
    ws.getCell(`G${row}`).value = history.new_degree || '';
    ws.getCell(`H${row}`).value = history.new_rank || '';
    ws.getCell(`I${row}`).value = formatDateTR(history.new_degree_rank_date);
    if (history.note) ws.getCell(`J${row}`).value = history.note;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, truncated };
}

module.exports = { fillPromotionForm, fillSalaryChangeForm, formatDateTR };
