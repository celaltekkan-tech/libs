'use strict';

const PERMISSIONS = [
  { permission_key: 'attendance.read', description: 'Devamsızlık ve DYK kayıtlarını listeleme' },
  { permission_key: 'attendance.create', description: 'Devamsızlık / DYK kaydı oluşturma' },
  { permission_key: 'attendance.update', description: 'Devamsızlık / DYK kaydı güncelleme' },
  { permission_key: 'attendance.delete', description: 'Devamsızlık / DYK kaydı silme' },
];

const ROLE_KEYS = {
  'Müdür': ['attendance.read', 'attendance.create', 'attendance.update', 'attendance.delete'],
  'Müdür Yardımcısı': ['attendance.read', 'attendance.create', 'attendance.update', 'attendance.delete'],
  'Memur': ['attendance.read', 'attendance.create'],
  'Öğretmen': ['attendance.read', 'attendance.create'],
};

async function selectAll(queryInterface, sql, replacements) {
  const [rows] = await queryInterface.sequelize.query(sql, { replacements });
  return rows;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const prefix = 'attendance.%';

    const existing = await selectAll(queryInterface, `SELECT permission_key FROM permissions WHERE permission_key LIKE :prefix`, { prefix });
    const existingKeys = new Set(existing.map((r) => r.permission_key));
    const missing = PERMISSIONS.filter((p) => !existingKeys.has(p.permission_key));
    if (missing.length > 0) {
      await queryInterface.bulkInsert(
        'permissions',
        missing.map((p) => ({ permission_key: p.permission_key, description: p.description, created_at: now, updated_at: now }))
      );
    }

    const permissions = await selectAll(queryInterface, `SELECT id, permission_key FROM permissions WHERE permission_key LIKE :prefix`, { prefix });
    const permByKey = new Map(permissions.map((p) => [p.permission_key, p.id]));

    const roles = await selectAll(queryInterface, `SELECT id, role_name FROM roles WHERE role_name IN (:names)`, {
      names: Object.keys(ROLE_KEYS),
    });

    const existingRp = await selectAll(queryInterface, `SELECT role_id, permission_id FROM role_permissions`);
    const existingSet = new Set(existingRp.map((r) => `${r.role_id}:${r.permission_id}`));

    const rowsToInsert = [];
    for (const role of roles) {
      for (const key of ROLE_KEYS[role.role_name] || []) {
        const permissionId = permByKey.get(key);
        if (!permissionId) continue;
        const pair = `${role.id}:${permissionId}`;
        if (existingSet.has(pair)) continue;
        rowsToInsert.push({ role_id: role.id, permission_id: permissionId, created_at: now, updated_at: now });
      }
    }
    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rowsToInsert);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE permission_key LIKE 'attendance.%')`
    );
    await queryInterface.bulkDelete('permissions', { permission_key: PERMISSIONS.map((p) => p.permission_key) });
  },
};
