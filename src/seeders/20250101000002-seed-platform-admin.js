'use strict';

const bcrypt = require('bcrypt');

const TENANT_NAME = 'Platform Yönetimi';
const ADMIN_EMAIL = (process.env.PLATFORM_ADMIN_EMAIL || 'superadmin@lise-idari.local').toLowerCase();
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'SuperAdmin1234';

async function selectOne(queryInterface, sql, replacements) {
  const [rows] = await queryInterface.sequelize.query(sql, { replacements });
  return rows[0] || null;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    let tenant = await selectOne(
      queryInterface,
      'SELECT id FROM "Tenants" WHERE name = :name LIMIT 1',
      { name: TENANT_NAME }
    );

    if (!tenant) {
      await queryInterface.bulkInsert('Tenants', [
        { name: TENANT_NAME, plan: 'internal', is_active: true, created_at: now, updated_at: now },
      ]);
      tenant = await selectOne(
        queryInterface,
        'SELECT id FROM "Tenants" WHERE name = :name LIMIT 1',
        { name: TENANT_NAME }
      );
    }

    const existingUser = await selectOne(
      queryInterface,
      'SELECT id FROM "Users" WHERE email = :email LIMIT 1',
      { email: ADMIN_EMAIL }
    );

    if (!existingUser) {
      const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

      await queryInterface.bulkInsert('Users', [
        {
          tenant_id: tenant.id,
          school_id: null,
          full_name: 'Platform Yöneticisi',
          email: ADMIN_EMAIL,
          password_hash,
          role: 'admin',
          is_active: true,
          is_platform_admin: true,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    console.log(`Platform yöneticisi hazır: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  },

  async down(queryInterface) {
    const user = await selectOne(
      queryInterface,
      'SELECT id FROM "Users" WHERE email = :email LIMIT 1',
      { email: ADMIN_EMAIL }
    );

    if (user) {
      await queryInterface.bulkDelete('Users', { id: user.id });
    }

    await queryInterface.bulkDelete('Tenants', { name: TENANT_NAME });
  },
};
