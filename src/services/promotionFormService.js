'use strict';

const path = require('path');
const ExcelJS = require('exceljs');
const salaryFormMapping = require('../config/salaryFormMapping');
const promotionFormMapping = require('../config/promotionFormMapping');

const PROMOTION_FORM_TEMPLATE = path.join(__dirname, '..', 'templates', 'terfi_kademe_derece_formu.xlsx');
const SALARY_FORM_TEMPLATE = path.join(__dirname, '..', 'templates', 'maas_degisiklik_bildirim_formu.xlsx');

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

function writeMapped(ws, cell, value) {
  if (!cell) return;
  ws.getCell(cell).value = value == null || value === '' ? '' : value;
}

function writeRowBlock(ws, block, rows, mapRow) {
  if (!block || !block.startRow || !block.endRow || !block.columns) return false;
  const capacity = block.endRow - block.startRow + 1;
  const list = Array.isArray(rows) ? rows.slice(0, capacity) : [];
  list.forEach((item, idx) => {
    const row = block.startRow + idx;
    const values = mapRow(item) || {};
    Object.entries(block.columns).forEach(([field, col]) => {
      if (!col) return;
      writeMapped(ws, `${col}${row}`, values[field]);
    });
  });
  return Array.isArray(rows) && rows.length > capacity;
}

function cellText(cell) {
  if (cell.value == null) return '';
  if (typeof cell.value === 'object' && cell.value.richText) {
    return cell.value.richText.map((t) => t.text || '').join('');
  }
  if (typeof cell.value === 'object' && cell.value.formula) {
    return String(cell.value.result || '');
  }
  return String(cell.value);
}

function isInstructionalNote(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (s.startsWith('(')) return true;
  if (/sağlık raporları/i.test(s)) return true;
  if (/^Terfii Onayı/i.test(s)) return true;
  return false;
}

/** Örnek okul verisini siler; etiket, birleşik başlık ve belge notlarına dokunmaz. */
function clearSalaryFormSampleData(ws, mapping) {
  Object.values(mapping.header || {}).forEach((addr) => {
    if (!addr) return;
    ws.getCell(addr).value = '';
  });

  const blocks = [
    mapping.departureRows,
    mapping.starterRows,
    mapping.promotionRows,
    mapping.otherChangeRows,
    mapping.deductionRows,
    mapping.reportDayRows,
    mapping.unionChangeRows,
  ];
  blocks.forEach((block) => {
    if (!block) return;
    for (let row = block.startRow; row <= block.endRow; row += 1) {
      Object.values(block.columns || {}).forEach((col) => {
        if (!col) return;
        const cell = ws.getCell(`${col}${row}`);
        if (isInstructionalNote(cellText(cell))) return;
        cell.value = '';
      });
    }
  });
}

async function fillPromotionForm(history, teacher) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PROMOTION_FORM_TEMPLATE);
  const ws = wb.worksheets[0];
  const { cells } = promotionFormMapping;

  const values = {
    promotion_date: formatDateTR(history.new_degree_rank_date),
    city: teacher.city || '',
    district: teacher.district || '',
    personnel_no: teacher.personnel_no || '',
    national_id: teacher.national_id || '',
    full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim(),
    last_graduated_school: teacher.last_graduated_school || '',
    class_level: teacher.class_level || '',
    title_branch: teacher.title_branch || '',
    working_institution: teacher.working_institution || '',
    previous_degree: history.previous_degree || '',
    pension_degree: teacher.pension_degree || '',
    previous_rank: history.previous_rank || '',
    previous_degree_rank_date: formatDateTR(history.previous_degree_rank_date),
    new_degree: history.new_degree || '',
    pension_degree_new: teacher.pension_degree || '',
    new_rank: history.new_rank || '',
    new_degree_rank_date: formatDateTR(history.new_degree_rank_date),
    note: history.note || '',
    school_principal: teacher.school_principal || '',
  };

  Object.entries(cells || {}).forEach(([field, cell]) => {
    if (cell == null) return;
    writeMapped(ws, cell, values[field]);
  });

  return wb.xlsx.writeBuffer();
}

/**
 * Excel / PDF için ortak form modeli.
 * @param {Array<{history: object, teacher: object}>} promotionEntries
 * @param {{ month, year, draft?: object, institutionName?: string }} options
 */
function buildSalaryFormModel(promotionEntries, options) {
  const mapping = salaryFormMapping;
  const draft = options.draft || {};

  const header = {
    institution_name: draft.institution_name || options.institutionName || '',
    bank_branch: draft.bank_branch || '',
    month_name: MONTH_NAMES_TR[options.month - 1] || '',
    year: String(options.year),
    accounting_code: draft.accounting_code || '',
    previous_month: draft.previous_month_count ?? '',
    started: draft.started_count ?? '',
    left: draft.left_count ?? '',
    payable: draft.payable_count ?? '',
    form_date: draft.form_date || formatDateTR(new Date()),
    principal:
      draft.principal ||
      promotionEntries.find((e) => e.teacher.school_principal)?.teacher.school_principal ||
      '',
  };

  const cap = (block) => (block ? block.endRow - block.startRow + 1 : 0);
  const take = (rows, capacity) => (Array.isArray(rows) ? rows.slice(0, capacity) : []);
  const over = (rows, capacity) => Array.isArray(rows) && rows.length > capacity;

  const departures = take(draft.departures, cap(mapping.departureRows)).map((r) => ({
    personnel_no: r.personnel_no,
    full_name: r.full_name,
    national_id: r.national_id,
    leave_date: r.leave_date,
    leave_reason: r.leave_reason,
    documents: r.documents,
  }));

  const starters = take(draft.starters, cap(mapping.starterRows)).map((r) => ({
    personnel_no: r.personnel_no,
    full_name: r.full_name,
    national_id: r.national_id,
    iban: r.iban,
    start_reason: r.start_reason,
    start_date: r.start_date,
    documents: r.documents,
  }));

  const promotions = take(promotionEntries, cap(mapping.promotionRows)).map(({ history, teacher }) => ({
    personnel_no: teacher.personnel_no || '',
    full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim(),
    national_id: teacher.national_id || '',
    previous_degree: history.previous_degree || '',
    previous_rank: history.previous_rank || '',
    new_degree: history.new_degree || '',
    new_rank: history.new_rank || '',
    promotion_date: formatDateTR(history.new_degree_rank_date),
    documents: history.note || '',
  }));

  const other_changes = take(draft.other_changes, cap(mapping.otherChangeRows)).map((r) => ({
    personnel_no: r.personnel_no,
    full_name: r.full_name,
    national_id: r.national_id,
    previous_status: r.previous_status,
    new_status: r.new_status,
    documents: r.documents,
  }));

  const deductions = take(draft.deductions, cap(mapping.deductionRows)).map((r) => ({
    personnel_no: r.personnel_no,
    full_name: r.full_name,
    national_id: r.national_id,
    reason: r.reason,
    amount: r.amount,
    documents: r.documents,
  }));

  const report_days = take(draft.report_days, cap(mapping.reportDayRows)).map((r) => ({
    personnel_no: r.personnel_no,
    full_name: r.full_name,
    national_id: r.national_id,
    start_date: r.start_date,
    days_after_7: r.days_after_7,
    documents: r.documents,
  }));

  const union_changes = take(draft.union_changes, cap(mapping.unionChangeRows)).map((r) => ({
    personnel_no: r.personnel_no,
    full_name: r.full_name,
    national_id: r.national_id,
    left_union: r.left_union,
    joined_union: r.joined_union,
    documents: r.documents,
  }));

  const truncated =
    over(draft.departures, cap(mapping.departureRows)) ||
    over(draft.starters, cap(mapping.starterRows)) ||
    over(promotionEntries, cap(mapping.promotionRows)) ||
    over(draft.other_changes, cap(mapping.otherChangeRows)) ||
    over(draft.deductions, cap(mapping.deductionRows)) ||
    over(draft.report_days, cap(mapping.reportDayRows)) ||
    over(draft.union_changes, cap(mapping.unionChangeRows));

  return {
    header,
    departures,
    starters,
    promotions,
    other_changes,
    deductions,
    report_days,
    union_changes,
    truncated,
  };
}

/**
 * @param {Array<{history: object, teacher: object}>} promotionEntries DB terfi kayıtları
 * @param {{ month, year, draft?: object }} options draft = SalaryFormDraft.payload
 */
async function fillSalaryChangeForm(promotionEntries, options) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SALARY_FORM_TEMPLATE);
  const ws = wb.worksheets[0];
  const mapping = salaryFormMapping;
  const model = buildSalaryFormModel(promotionEntries, options);
  clearSalaryFormSampleData(ws, mapping);

  Object.entries(mapping.header || {}).forEach(([field, cell]) => {
    if (cell == null) return;
    writeMapped(ws, cell, model.header[field]);
  });

  writeRowBlock(ws, mapping.departureRows, model.departures, (r) => r);
  writeRowBlock(ws, mapping.starterRows, model.starters, (r) => r);
  writeRowBlock(ws, mapping.promotionRows, model.promotions, (r) => r);
  writeRowBlock(ws, mapping.otherChangeRows, model.other_changes, (r) => r);
  writeRowBlock(ws, mapping.deductionRows, model.deductions, (r) => r);
  writeRowBlock(ws, mapping.reportDayRows, model.report_days, (r) => r);
  writeRowBlock(ws, mapping.unionChangeRows, model.union_changes, (r) => r);

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, truncated: model.truncated };
}

module.exports = {
  fillPromotionForm,
  fillSalaryChangeForm,
  buildSalaryFormModel,
  formatDateTR,
};
