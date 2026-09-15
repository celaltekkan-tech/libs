'use strict';

const TRAINING_KEYS = [
  'trainings.read',
  'trainings.create',
  'trainings.update',
  'trainings.delete',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions WHERE permission_id IN (
         SELECT id FROM permissions WHERE permission_key LIKE 'trainings.%'
       )`
    );
    await queryInterface.bulkDelete('permissions', {
      permission_key: TRAINING_KEYS,
    });
  },

  async down() {
    // Hizmet içi eğitim modülü iptal edildi; izinler geri eklenmez.
  },
};
