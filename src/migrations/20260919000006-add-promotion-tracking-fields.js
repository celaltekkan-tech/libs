'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'eight_year_base_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Teachers', 'degree_rank_anchor_date', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('PromotionHistories', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'manuel',
    });
    await queryInterface.addColumn('PromotionHistories', 'override_reason', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('PromotionHistories', 'is_permanent', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PromotionHistories', 'is_permanent');
    await queryInterface.removeColumn('PromotionHistories', 'override_reason');
    await queryInterface.removeColumn('PromotionHistories', 'type');
    await queryInterface.removeColumn('Teachers', 'degree_rank_anchor_date');
    await queryInterface.removeColumn('Teachers', 'eight_year_base_date');
  },
};
