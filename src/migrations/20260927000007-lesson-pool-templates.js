'use strict';

// Platform yöneticisinin MEB haftalık ders çizelgesinden (PDF/Excel) oluşturduğu
// hazır ders havuzları. Okullar bunu kendi ders havuzlarına aktarır.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LessonPoolTemplates', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      // ilkokul | ortaokul | lise (null: hepsi)
      school_type: { type: Sequelize.STRING(20), allowNull: true },
      // Sütun sırası: ["Hazırlık", "9", "10", "11", "12"]
      levels: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      // [{ name, kind: ortak|secmeli|rehberlik, category, max_takes, hours: { "9": [5] } }]
      items: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      source_name: { type: Sequelize.STRING(255), allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
    });

    // Seçmeli dersin kaç kez alınabileceği (çizelgede ders adının yanındaki parantez).
    const subjects = await queryInterface.describeTable('Subjects');
    if (!subjects.max_takes) {
      await queryInterface.addColumn('Subjects', 'max_takes', { type: Sequelize.INTEGER, allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Subjects', 'max_takes');
    await queryInterface.dropTable('LessonPoolTemplates');
  },
};
