'use strict';

const { Holiday } = require('../models');

// Sabit tarihli, her yıl tekrarlanan resmi tatiller. Tarihi yıldan yıla
// değişen dini bayramlar (Ramazan/Kurban Bayramı) burada yer almaz; kurum
// yöneticisi bunları Resmi Tatiller ekranından yıla özel olarak ekleyebilir.
const DEFAULT_HOLIDAYS = [
  { name: 'Yılbaşı', month: 1, day: 1 },
  { name: 'Ulusal Egemenlik ve Çocuk Bayramı', month: 4, day: 23 },
  { name: 'Emek ve Dayanışma Günü', month: 5, day: 1 },
  { name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", month: 5, day: 19 },
  { name: 'Demokrasi ve Milli Birlik Günü', month: 7, day: 15 },
  { name: 'Zafer Bayramı', month: 8, day: 30 },
  { name: 'Cumhuriyet Bayramı', month: 10, day: 29 },
];

async function seedDefaultHolidays(tenantId, options = {}) {
  const rows = DEFAULT_HOLIDAYS.map((h) => ({
    tenant_id: tenantId,
    name: h.name,
    month: h.month,
    day: h.day,
    year: null,
  }));
  await Holiday.bulkCreate(rows, { ignoreDuplicates: true, transaction: options.transaction });
}

module.exports = { DEFAULT_HOLIDAYS, seedDefaultHolidays };
