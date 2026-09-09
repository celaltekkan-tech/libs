'use strict';

// Rehberlik modülü gizlilik dereceli olduğu için ayrı bir rol gerektirir.
// Yeni rol, mevcut "Öğretmen" rolünün o ana kadar tanımlı tüm izinlerini
// devralır (temel erişim), rehberlik izinleri ayrı bir seeder ile eklenir.
const NEW_ROLE = 'Rehber Öğretmen';
const BASE_ROLE = 'Öğretmen';

async function selectAll(queryInterface, sql, replacements) {
  const [rows] = await queryInterface.sequelize.query(sql, { replacements });
  return rows;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const existingRole = await selectAll(queryInterface, 'SELECT id FROM roles WHERE role_name = :name', {
      name: NEW_ROLE,
    });
    if (existingRole.length === 0) {
      await queryInterface.bulkInsert('roles', [{ role_name: NEW_ROLE, created_at: now, updated_at: now }]);
    }

    const [newRole] = await selectAll(queryInterface, 'SELECT id FROM roles WHERE role_name = :name', {
      name: NEW_ROLE,
    });
    const [baseRole] = await selectAll(queryInterface, 'SELECT id FROM roles WHERE role_name = :name', {
      name: BASE_ROLE,
    });
    if (!newRole || !baseRole) return;

    const basePermissions = await selectAll(
      queryInterface,
      'SELECT permission_id FROM role_permissions WHERE role_id = :roleId',
      { roleId: baseRole.id }
    );
    const existingNewRolePerms = await selectAll(
      queryInterface,
      'SELECT permission_id FROM role_permissions WHERE role_id = :roleId',
      { roleId: newRole.id }
    );
    const existingSet = new Set(existingNewRolePerms.map((r) => r.permission_id));

    const rowsToInsert = basePermissions
      .filter((p) => !existingSet.has(p.permission_id))
      .map((p) => ({ role_id: newRole.id, permission_id: p.permission_id, created_at: now, updated_at: now }));

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rowsToInsert);
    }
  },

  async down(queryInterface) {
    const [role] = await selectAll(queryInterface, 'SELECT id FROM roles WHERE role_name = :name', { name: NEW_ROLE });
    if (role) {
      await queryInterface.bulkDelete('role_permissions', { role_id: role.id });
      await queryInterface.bulkDelete('roles', { id: role.id });
    }
  },
};
