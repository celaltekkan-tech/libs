'use strict';

/** Evrak arşivi personele bağlı olmaktan çıkar; ortak gruplara ayrılır. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('TeacherDocuments', 'category', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'yillik_evrak',
    });
    await queryInterface.sequelize.query(`
      UPDATE "TeacherDocuments"
      SET category = CASE doc_type
        WHEN 'sinif_rehberlik_plani' THEN 'sinif_rehberlik'
        WHEN 'ogrenci_gelisim_raporu' THEN 'sinif_rehberlik'
        WHEN 'maarif_modeli_raporu' THEN 'maarif'
        ELSE 'yillik_evrak'
      END
    `);
    await queryInterface.sequelize.query(
      'ALTER TABLE "TeacherDocuments" ALTER COLUMN "teacher_id" DROP NOT NULL',
    );
    await queryInterface.addIndex('TeacherDocuments', ['category'], { name: 'teacher_documents_category_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('TeacherDocuments', 'teacher_documents_category_idx');
    await queryInterface.sequelize.query(
      'ALTER TABLE "TeacherDocuments" ALTER COLUMN "teacher_id" SET NOT NULL',
    );
    await queryInterface.removeColumn('TeacherDocuments', 'category');
  },
};
