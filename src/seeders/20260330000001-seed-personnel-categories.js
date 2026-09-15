'use strict';

const DEFAULTS = [
  { name: 'Memur', code: 'memur', sort_order: 10 },
  { name: 'İşçi', code: 'isci', sort_order: 20 },
  { name: 'TYP Personeli', code: 'typ', sort_order: 30 },
];

async function selectAll(queryInterface, sql, replacements) {
  const [rows] = await queryInterface.sequelize.query(sql, { replacements });
  return rows;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const tenants = await selectAll(queryInterface, 'SELECT id FROM "Tenants"');

    for (const tenant of tenants) {
      const existing = await selectAll(
        queryInterface,
        `SELECT code FROM "PersonnelCategories" WHERE tenant_id = :tenantId`,
        { tenantId: tenant.id }
      );
      const have = new Set(existing.map((r) => r.code).filter(Boolean));
      const missing = DEFAULTS.filter((d) => !have.has(d.code));
      if (missing.length > 0) {
        await queryInterface.bulkInsert(
          'PersonnelCategories',
          missing.map((d) => ({
            tenant_id: tenant.id,
            name: d.name,
            code: d.code,
            sort_order: d.sort_order,
            created_at: now,
            updated_at: now,
          }))
        );
      }

      const cats = await selectAll(
        queryInterface,
        `SELECT id, code FROM "PersonnelCategories" WHERE tenant_id = :tenantId AND code IS NOT NULL`,
        { tenantId: tenant.id }
      );
      for (const cat of cats) {
        await queryInterface.sequelize.query(
          `UPDATE "Teachers"
              SET personnel_category_id = :catId, updated_at = :now
            WHERE tenant_id = :tenantId
              AND personnel_type = :code
              AND personnel_category_id IS NULL`,
          { replacements: { catId: cat.id, now, tenantId: tenant.id, code: cat.code } }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE "Teachers" SET personnel_category_id = NULL WHERE personnel_category_id IS NOT NULL`
    );
    await queryInterface.bulkDelete('PersonnelCategories', { code: DEFAULTS.map((d) => d.code) });
  },
};
