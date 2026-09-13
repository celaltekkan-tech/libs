'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('StudentAbsences', 'absence_type', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Mevcut kayıtları yeni alana taşı: is_excused=true -> mazeretli, false -> mazeretsiz.
    await queryInterface.sequelize.query(
      `UPDATE "StudentAbsences" SET absence_type = CASE WHEN is_excused THEN 'mazeretli' ELSE 'mazeretsiz' END`
    );

    await queryInterface.changeColumn('StudentAbsences', 'absence_type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'mazeretsiz',
    });

    await queryInterface.removeColumn('StudentAbsences', 'is_excused');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('StudentAbsences', 'is_excused', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(
      `UPDATE "StudentAbsences" SET is_excused = (absence_type IN ('mazeretli', 'raporlu'))`
    );
    await queryInterface.removeColumn('StudentAbsences', 'absence_type');
  },
};
