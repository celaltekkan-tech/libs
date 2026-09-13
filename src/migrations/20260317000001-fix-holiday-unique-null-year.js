'use strict';

/** Mevcut mükerrer resmi tatilleri temizler ve year=NULL için de çalışan unique index ekler.
 * PostgreSQL'de klasik UNIQUE(year) NULL değerleri eşit saymadığı için aynı güne
 * tekrarlı kayıt oluşabiliyordu; COALESCE(year, 0) ile bunu engelliyoruz.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM "Holidays" a
      USING "Holidays" b
      WHERE a.id > b.id
        AND a.tenant_id = b.tenant_id
        AND a.month = b.month
        AND a.day = b.day
        AND a.year IS NOT DISTINCT FROM b.year
    `);

    await queryInterface.removeIndex('Holidays', 'holidays_tenant_month_day_year_unique');

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX holidays_tenant_month_day_year_unique
      ON "Holidays" (tenant_id, month, day, (COALESCE(year, 0)))
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS holidays_tenant_month_day_year_unique
    `);

    await queryInterface.addIndex('Holidays', ['tenant_id', 'month', 'day', 'year'], {
      unique: true,
      name: 'holidays_tenant_month_day_year_unique',
    });
  },
};
