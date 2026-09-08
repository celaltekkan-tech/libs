'use strict';

const ROLE_NAMES = ['Müdür', 'Müdür Yardımcısı', 'Memur', 'Öğretmen'];

const PERMISSIONS = [
  { permission_key: 'teachers.read', description: 'Öğretmen listeleme' },
  { permission_key: 'teachers.create', description: 'Öğretmen oluşturma' },
  { permission_key: 'teachers.update', description: 'Öğretmen güncelleme' },
  { permission_key: 'teachers.delete', description: 'Öğretmen silme' },
  { permission_key: 'users.read', description: 'Kullanıcı listeleme' },
  { permission_key: 'users.create', description: 'Kullanıcı oluşturma' },
  { permission_key: 'users.update', description: 'Kullanıcı güncelleme' },
  { permission_key: 'users.delete', description: 'Kullanıcı silme' },
  { permission_key: 'schools.read', description: 'Okul listeleme' },
  { permission_key: 'schools.create', description: 'Okul oluşturma' },
  { permission_key: 'schools.update', description: 'Okul güncelleme' },
  { permission_key: 'schools.delete', description: 'Okul silme' },
];

const ROLE_PERMISSIONS = {
  'Müdür': PERMISSIONS.map((p) => p.permission_key),
  'Müdür Yardımcısı': [
    'teachers.read', 'teachers.create', 'teachers.update', 'teachers.delete',
    'users.read', 'users.create', 'users.update',
    'schools.read',
  ],
  'Memur': [
    'teachers.read', 'teachers.create', 'teachers.update',
    'users.read',
    'schools.read',
  ],
  'Öğretmen': ['teachers.read', 'users.read', 'schools.read'],
};

async function selectAll(queryInterface, sql) {
  const [rows] = await queryInterface.sequelize.query(sql);
  return rows;
}

module.exports = {
  // Seeder tekrar çalıştırıldığında mevcut kayıtlar korunur, yalnızca
  // eksik olanlar eklenir.
  async up(queryInterface) {
    const now = new Date();

    const existingRoles = await selectAll(queryInterface, 'SELECT role_name FROM roles');
    const existingRoleNames = existingRoles.map((r) => r.role_name);
    const missingRoles = ROLE_NAMES.filter((name) => !existingRoleNames.includes(name));

    if (missingRoles.length > 0) {
      await queryInterface.bulkInsert(
        'roles',
        missingRoles.map((role_name) => ({ role_name, created_at: now, updated_at: now }))
      );
    }

    const existingPermissions = await selectAll(
      queryInterface,
      'SELECT permission_key FROM permissions'
    );
    const existingKeys = existingPermissions.map((p) => p.permission_key);
    const missingPermissions = PERMISSIONS.filter(
      (p) => !existingKeys.includes(p.permission_key)
    );

    if (missingPermissions.length > 0) {
      await queryInterface.bulkInsert(
        'permissions',
        missingPermissions.map((p) => ({ ...p, created_at: now, updated_at: now }))
      );
    }

    const roles = await selectAll(queryInterface, 'SELECT id, role_name FROM roles');
    const permissions = await selectAll(
      queryInterface,
      'SELECT id, permission_key FROM permissions'
    );
    const existingLinks = await selectAll(
      queryInterface,
      'SELECT role_id, permission_id FROM role_permissions'
    );

    const roleMap = Object.fromEntries(roles.map((r) => [r.role_name, r.id]));
    const permissionMap = Object.fromEntries(
      permissions.map((p) => [p.permission_key, p.id])
    );
    const linkKeys = new Set(existingLinks.map((l) => `${l.role_id}:${l.permission_id}`));

    const rowsToInsert = [];

    Object.entries(ROLE_PERMISSIONS).forEach(([roleName, permissionKeys]) => {
      const roleId = roleMap[roleName];
      if (!roleId) return;

      permissionKeys.forEach((key) => {
        const permissionId = permissionMap[key];
        if (!permissionId) return;
        if (linkKeys.has(`${roleId}:${permissionId}`)) return;

        rowsToInsert.push({
          role_id: roleId,
          permission_id: permissionId,
          created_at: now,
          updated_at: now,
        });
      });
    });

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rowsToInsert);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('permissions', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
