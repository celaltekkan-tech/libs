'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'personnel_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'ogretmen',
    });
    await queryInterface.addColumn('Teachers', 'contract_start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('Teachers', 'contract_end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Teachers', 'personnel_type');
    await queryInterface.removeColumn('Teachers', 'contract_start_date');
    await queryInterface.removeColumn('Teachers', 'contract_end_date');
  },
};
