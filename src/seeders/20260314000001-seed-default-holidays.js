'use strict';

const DEFAULT_HOLIDAYS = [
  { name: 'Yılbaşı', month: 1, day: 1 },
  { name: 'Ulusal Egemenlik ve Çocuk Bayramı', month: 4, day: 23 },
  { name: 'Emek ve Dayanışma Günü', month: 5, day: 1 },
  { name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", month: 5, day: 19 },
  { name: 'Demokrasi ve Milli Birlik Günü', month: 7, day: 15 },
  { name: 'Zafer Bayramı', month: 8, day: 30 },
  { name: 'Cumhuriyet Bayramı', month: 10, day: 29 },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [tenants] = await queryInterface.sequelize.query('SELECT id FROM "Tenants"');
    if (tenants.length === 0) return;

    const [existing] = await queryInterface.sequelize.query(
      'SELECT tenant_id, month, day, year FROM "Holidays"'
    );
    const existingSet = new Set(existing.map((h) => `${h.tenant_id}:${h.month}:${h.day}:${h.year ?? 'null'}`));

    const rows = [];
    for (const tenant of tenants) {
      for (const h of DEFAULT_HOLIDAYS) {
        const key = `${tenant.id}:${h.month}:${h.day}:null`;
        if (existingSet.has(key)) continue;
        rows.push({
          tenant_id: tenant.id,
          name: h.name,
          month: h.month,
          day: h.day,
          year: null,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (rows.length > 0) {
      await queryInterface.bulkInsert('Holidays', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Holidays', {
      name: DEFAULT_HOLIDAYS.map((h) => h.name),
    });
  },
};
