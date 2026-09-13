'use strict';

const { Op } = require('sequelize');
const { Holiday } = require('../models');

// Sabit tarihli, her yıl tekrarlanan resmi tatiller. Tarihi yıldan yıla
// değişen dini bayramlar (Ramazan/Kurban Bayramı) burada yer almaz; kurum
// yöneticisi bunları Resmi Tatiller ekranından tarih aralığı ile ekleyebilir.
const DEFAULT_HOLIDAYS = [
  { name: 'Yılbaşı', month: 1, day: 1 },
  { name: 'Ulusal Egemenlik ve Çocuk Bayramı', month: 4, day: 23 },
  { name: 'Emek ve Dayanışma Günü', month: 5, day: 1 },
  { name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", month: 5, day: 19 },
  { name: 'Demokrasi ve Milli Birlik Günü', month: 7, day: 15 },
  { name: 'Zafer Bayramı', month: 8, day: 30 },
  { name: 'Cumhuriyet Bayramı', month: 10, day: 29 },
];

function parseIsoDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day, time: date.getTime() };
}

async function seedDefaultHolidays(tenantId, options = {}) {
  const existing = await Holiday.findAll({
    where: { tenant_id: tenantId, year: null },
    attributes: ['month', 'day'],
    transaction: options.transaction,
  });
  const existingKeys = new Set(existing.map((h) => `${h.month}-${h.day}`));

  const rows = DEFAULT_HOLIDAYS.filter((h) => !existingKeys.has(`${h.month}-${h.day}`)).map((h) => ({
    tenant_id: tenantId,
    name: h.name,
    month: h.month,
    day: h.day,
    year: null,
  }));

  if (rows.length === 0) return [];
  return Holiday.bulkCreate(rows, { transaction: options.transaction });
}

/** Aynı tenant + ay + gün + yıl (null dahil) için kayıt var mı? */
async function findExistingHoliday(tenantId, { month, day, year }, options = {}) {
  const where = { tenant_id: tenantId, month, day };
  if (year == null) where.year = { [Op.is]: null };
  else where.year = year;
  return Holiday.findOne({ where, transaction: options.transaction });
}

/**
 * Tek gün veya tarih aralığı için resmi tatil kayıtları oluşturur.
 * Aralık gün gün genişletilir; zaten tanımlı günler atlanır.
 */
async function createHolidays(tenantId, payload, options = {}) {
  const days = [];

  if (payload.start_date && payload.end_date) {
    const start = parseIsoDate(payload.start_date);
    const end = parseIsoDate(payload.end_date);
    if (!start || !end) {
      const err = new Error('Geçersiz tarih aralığı');
      err.status = 400;
      throw err;
    }
    if (end.time < start.time) {
      const err = new Error('Bitiş tarihi başlangıçtan önce olamaz');
      err.status = 400;
      throw err;
    }
    for (let t = start.time; t <= end.time; t += 24 * 60 * 60 * 1000) {
      const d = new Date(t);
      days.push({
        name: payload.name,
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        year: payload.recurring ? null : d.getUTCFullYear(),
      });
    }
    // Çok yıllı aralıkta "her yıl" anlamsız; yalnızca tek güne izin ver.
    if (payload.recurring && days.length > 1) {
      const err = new Error('Her yıl tekrarlayan tatil yalnızca tek gün için tanımlanabilir');
      err.status = 400;
      throw err;
    }
  } else {
    days.push({
      name: payload.name,
      month: payload.month,
      day: payload.day,
      year: payload.year ?? null,
    });
  }

  const created = [];
  let skipped = 0;
  for (const day of days) {
    const existing = await findExistingHoliday(tenantId, day, options);
    if (existing) {
      skipped += 1;
      continue;
    }
    created.push(
      await Holiday.create(
        {
          tenant_id: tenantId,
          name: day.name,
          month: day.month,
          day: day.day,
          year: day.year,
        },
        { transaction: options.transaction },
      ),
    );
  }

  return { created, skipped, total: days.length };
}

module.exports = {
  DEFAULT_HOLIDAYS,
  seedDefaultHolidays,
  createHolidays,
  findExistingHoliday,
};
