'use strict';

/**
 * Menü / denetim / geri bildirim için eksik permission key'leri.
 * Her menü en az *.read ile kontrol edilebilir.
 */
const EXTRA = [
  { permission_key: 'audit.read', description: 'Denetim kayıtlarını görüntüleme' },
  { permission_key: 'feedback.read', description: 'Geri bildirim menüsüne erişim' },
  { permission_key: 'feedback.create', description: 'Geri bildirim gönderme' },
];

const MUDUR_EXTRAS = ['audit.read', 'feedback.read', 'feedback.create'];
const ALL_ROLES_FEEDBACK = ['feedback.read', 'feedback.create'];

async function selectAll(qi, sql) {
  const [rows] = await qi.sequelize.query(sql);
  return rows;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const existing = await selectAll(queryInterface, 'SELECT permission_key FROM permissions');
    const keys = new Set(existing.map((r) => r.permission_key));
    const missing = EXTRA.filter((p) => !keys.has(p.permission_key));
    if (missing.length) {
      await queryInterface.bulkInsert(
        'permissions',
        missing.map((p) => ({ ...p, created_at: now, updated_at: now })),
      );
    }

    const perms = await selectAll(queryInterface, 'SELECT id, permission_key FROM permissions');
    const permByKey = Object.fromEntries(perms.map((p) => [p.permission_key, p.id]));
    const roles = await selectAll(
      queryInterface,
      `SELECT id, role_name FROM roles WHERE tenant_id IS NULL OR tenant_id IS NULL`,
    );

    for (const role of roles) {
      const want =
        role.role_name === 'Müdür'
          ? [...new Set([...MUDUR_EXTRAS, ...ALL_ROLES_FEEDBACK])]
          : ALL_ROLES_FEEDBACK;
      for (const key of want) {
        const pid = permByKey[key];
        if (!pid) continue;
        const [exists] = await queryInterface.sequelize.query(
          `SELECT id FROM role_permissions WHERE role_id = :rid AND permission_id = :pid LIMIT 1`,
          { replacements: { rid: role.id, pid } },
        );
        if (!exists.length) {
          await queryInterface.bulkInsert('role_permissions', [
            { role_id: role.id, permission_id: pid, created_at: now, updated_at: now },
          ]);
        }
      }
    }
  },

  async down(queryInterface) {
    const keys = EXTRA.map((p) => `'${p.permission_key}'`).join(',');
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE permission_key IN (${keys}))`,
    );
    await queryInterface.sequelize.query(`DELETE FROM permissions WHERE permission_key IN (${keys})`);
  },
};
