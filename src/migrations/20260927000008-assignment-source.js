'use strict';

// Atamanın kaynağı: 'pool' = ders havuzundaki ortak dersten otomatik eklendi.
// Kaldırılan otomatik dersler proje ayarında (settings.common_excluded) tutulur
// ki bir sonraki eşitlemede geri gelmesin.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('TimetableAssignments');
    if (!table.source) {
      await queryInterface.addColumn('TimetableAssignments', 'source', { type: Sequelize.STRING(16), allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('TimetableAssignments', 'source');
  },
};
