'use strict';

const bcrypt = require('bcrypt');

const TENANT_NAME = 'Demo Eğitim Kurumu';
const SCHOOL_CODE = 'DEMO-001';
const SCHOOL_NAME = 'Demo Anadolu Lisesi';
const ADMIN_EMAIL = (process.env.DEMO_ADMIN_EMAIL || 'admin@okul.local').toLowerCase();
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'Admin1234';

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
        { name: TENANT_NAME, plan: 'free', created_at: now, updated_at: now },
      ]);
      tenant = await selectOne(
        queryInterface,
        'SELECT id FROM "Tenants" WHERE name = :name LIMIT 1',
        { name: TENANT_NAME }
      );
    }

    let school = await selectOne(
      queryInterface,
      'SELECT id FROM "Schools" WHERE code = :code LIMIT 1',
      { code: SCHOOL_CODE }
    );

    if (!school) {
      await queryInterface.bulkInsert('Schools', [
        {
          tenant_id: tenant.id,
          name: SCHOOL_NAME,
          code: SCHOOL_CODE,
          created_at: now,
          updated_at: now,
        },
      ]);
      school = await selectOne(
        queryInterface,
        'SELECT id FROM "Schools" WHERE code = :code LIMIT 1',
        { code: SCHOOL_CODE }
      );
    }

    let user = await selectOne(
      queryInterface,
      'SELECT id FROM "Users" WHERE email = :email LIMIT 1',
      { email: ADMIN_EMAIL }
    );

    if (!user) {
      const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

      await queryInterface.bulkInsert('Users', [
        {
          tenant_id: tenant.id,
          school_id: school.id,
          full_name: 'Demo Okul Müdürü',
          email: ADMIN_EMAIL,
          password_hash,
          role: 'admin',
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ]);

      user = await selectOne(
        queryInterface,
        'SELECT id FROM "Users" WHERE email = :email LIMIT 1',
        { email: ADMIN_EMAIL }
      );
    }

    const role = await selectOne(
      queryInterface,
      "SELECT id FROM roles WHERE role_name = 'Müdür' LIMIT 1"
    );

    if (role) {
      const existingAssignment = await selectOne(
        queryInterface,
        'SELECT id FROM users_schools WHERE user_id = :userId AND school_id = :schoolId LIMIT 1',
        { userId: user.id, schoolId: school.id }
      );

      if (!existingAssignment) {
        await queryInterface.bulkInsert('users_schools', [
          {
            user_id: user.id,
            school_id: school.id,
            role_id: role.id,
            created_at: now,
            updated_at: now,
          },
        ]);
      }
    }

    console.log(`Demo yönetici hazır: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  },

  async down(queryInterface) {
    const user = await selectOne(
      queryInterface,
      'SELECT id FROM "Users" WHERE email = :email LIMIT 1',
      { email: ADMIN_EMAIL }
    );

    if (user) {
      await queryInterface.bulkDelete('users_schools', { user_id: user.id });
      await queryInterface.bulkDelete('Users', { id: user.id });
    }

    await queryInterface.bulkDelete('Schools', { code: SCHOOL_CODE });
    await queryInterface.bulkDelete('Tenants', { name: TENANT_NAME });
  },
};
