'use strict';

const { splitUnvanBrans, normalizeKariyer } = require('../utils/teacherTitle');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Teachers', 'unvan', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Teachers', 'brans', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Teachers', 'kariyer', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    const [rows] = await queryInterface.sequelize.query(
      `SELECT id, title_branch, personnel_type, meta FROM "Teachers"`,
    );
    for (const row of rows) {
      const split = splitUnvanBrans(row.title_branch);
      const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      const seviye = meta.seviye_unvani || split.kariyerHint;
      const kariyer =
        row.personnel_type === 'ogretmen' ? normalizeKariyer(seviye) : null;
      await queryInterface.sequelize.query(
        `UPDATE "Teachers"
         SET unvan = :unvan, brans = :brans, kariyer = :kariyer
         WHERE id = :id`,
        {
          replacements: {
            id: row.id,
            unvan: split.unvan,
            brans: split.brans,
            kariyer,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Teachers', 'kariyer');
    await queryInterface.removeColumn('Teachers', 'brans');
    await queryInterface.removeColumn('Teachers', 'unvan');
  },
};
