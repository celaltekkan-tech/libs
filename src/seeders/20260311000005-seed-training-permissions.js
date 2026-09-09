'use strict';

const TRAINING_PERMISSIONS = [
  { permission_key: 'trainings.read', description: 'Hizmet içi eğitim kayıtlarını listeleme' },
  { permission_key: 'trainings.create', description: 'Hizmet içi eğitim kaydı oluşturma' },
  { permission_key: 'trainings.update', description: 'Hizmet içi eğitim kaydı güncelleme' },
  { permission_key: 'trainings.delete', description: 'Hizmet içi eğitim kaydı silme' },
];

const ROLE_KEYS = {
  'Müdür': ['trainings.read', 'trainings.create', 'trainings.update', 'trainings.delete'],
  'Müdür Yardımcısı': ['trainings.read', 'trainings.create', 'trainings.update'],
  'Memur': ['trainings.read', 'trainings.create'],
  'Öğretmen': ['trainings.read'],
};

async function selectAll(queryInterface, sql, replacements) {
  const [rows] = await queryInterface.sequelize.query(sql, { replacements });
  return rows;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const existing = await selectAll(
      queryInterface,
      `SELECT permission_key FROM permissions WHERE permission_key LIKE 'trainings.%'`
    );
    const existingKeys = new Set(existing.map((r) => r.permission_key));
    const missing = TRAINING_PERMISSIONS.filter((p) => !existingKeys.has(p.permission_key));

    if (missing.length > 0) {
      await queryInterface.bulkInsert(
        'permissions',
        missing.map((p) => ({
          permission_key: p.permission_key,
          description: p.description,
          created_at: now,
          updated_at: now,
        }))
      );
    }

    const permissions = await selectAll(
      queryInterface,
      `SELECT id, permission_key FROM permissions WHERE permission_key LIKE 'trainings.%'`
    );
    const permByKey = new Map(permissions.map((p) => [p.permission_key, p.id]));

    const roles = await selectAll(
      queryInterface,
      `SELECT id, role_name FROM roles WHERE role_name IN (:names)`,
      { names: Object.keys(ROLE_KEYS) }
    );

    const existingRp = await selectAll(
      queryInterface,
      `SELECT role_id, permission_id FROM role_permissions`
    );
    const existingSet = new Set(existingRp.map((r) => `${r.role_id}:${r.permission_id}`));

    const rowsToInsert = [];
    for (const role of roles) {
      for (const key of ROLE_KEYS[role.role_name] || []) {
        const permissionId = permByKey.get(key);
        if (!permissionId) continue;
        const pair = `${role.id}:${permissionId}`;
        if (existingSet.has(pair)) continue;
        rowsToInsert.push({
          role_id: role.id,
          permission_id: permissionId,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rowsToInsert);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions WHERE permission_id IN (
         SELECT id FROM permissions WHERE permission_key LIKE 'trainings.%'
       )`
    );
    await queryInterface.bulkDelete('permissions', {
      permission_key: TRAINING_PERMISSIONS.map((p) => p.permission_key),
    });
  },
};
