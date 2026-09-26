'use strict';

// Yapay Zekâ eklentisine özel günlük istek sınırı. NULL = sistem varsayılanı
// (AI_DAILY_LIMIT_PER_TENANT), 0 = sınırsız.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Licenses', 'ai_daily_limit', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Licenses', 'ai_daily_limit');
  },
};
