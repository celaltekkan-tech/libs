'use strict';

/** Nöbet yerlerine kat seviyesi ve aynı kat içi sıra ekler (haftalık kaydırma için). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('DutyLocations', 'floor_level', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('DutyLocations', 'sort_order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('DutyLocations', 'sort_order');
    await queryInterface.removeColumn('DutyLocations', 'floor_level');
  },
};
