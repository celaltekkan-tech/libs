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
 * @param {Array<{history: object, teacher: object}>} promotionEntries DB terfi kayıtları
 * @param {{ month, year, draft?: object }} options draft = SalaryFormDraft.payload
 */
async function fillSalaryChangeForm(promotionEntries, options) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SALARY_FORM_TEMPLATE);
  const ws = wb.worksheets[0];
  const mapping = salaryFormMapping;
  const draft = options.draft || {};

  const headerValues = {
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

  Object.entries(mapping.header || {}).forEach(([field, cell]) => {
    if (cell == null) return;
    writeMapped(ws, cell, headerValues[field]);
  });

  let truncated = false;

  truncated =
    writeRowBlock(ws, mapping.departureRows, draft.departures, (r) => ({
      personnel_no: r.personnel_no,
      full_name: r.full_name,
      national_id: r.national_id,
      leave_date: r.leave_date,
      leave_reason: r.leave_reason,
      documents: r.documents,
    })) || truncated;

  truncated =
    writeRowBlock(ws, mapping.starterRows, draft.starters, (r) => ({
      personnel_no: r.personnel_no,
      full_name: r.full_name,
      national_id: r.national_id,
      iban: r.iban,
      start_reason: r.start_reason,
      start_date: r.start_date,
      documents: r.documents,
    })) || truncated;

  truncated =
    writeRowBlock(
      ws,
      mapping.promotionRows,
      promotionEntries.map(({ history, teacher }) => ({ history, teacher })),
      ({ history, teacher }) => ({
        personnel_no: teacher.personnel_no || '',
        full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim(),
        national_id: teacher.national_id || '',
        previous_degree: history.previous_degree || '',
        previous_rank: history.previous_rank || '',
        new_degree: history.new_degree || '',
        new_rank: history.new_rank || '',
        promotion_date: formatDateTR(history.new_degree_rank_date),
        documents: history.note || '',
      })
    ) || truncated;

  truncated =
    writeRowBlock(ws, mapping.otherChangeRows, draft.other_changes, (r) => ({
      personnel_no: r.personnel_no,
      full_name: r.full_name,
      national_id: r.national_id,
      previous_status: r.previous_status,
      new_status: r.new_status,
      documents: r.documents,
    })) || truncated;

  truncated =
    writeRowBlock(ws, mapping.deductionRows, draft.deductions, (r) => ({
      personnel_no: r.personnel_no,
      full_name: r.full_name,
      national_id: r.national_id,
      reason: r.reason,
      amount: r.amount,
      documents: r.documents,
    })) || truncated;

  truncated =
    writeRowBlock(ws, mapping.reportDayRows, draft.report_days, (r) => ({
      personnel_no: r.personnel_no,
      full_name: r.full_name,
      national_id: r.national_id,
      start_date: r.start_date,
      days_after_7: r.days_after_7,
      documents: r.documents,
    })) || truncated;

  truncated =
    writeRowBlock(ws, mapping.unionChangeRows, draft.union_changes, (r) => ({
      personnel_no: r.personnel_no,
      full_name: r.full_name,
      national_id: r.national_id,
      left_union: r.left_union,
      joined_union: r.joined_union,
      documents: r.documents,
    })) || truncated;

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, truncated };
}

module.exports = {
  fillPromotionForm,
  fillSalaryChangeForm,
  formatDateTR,
};
