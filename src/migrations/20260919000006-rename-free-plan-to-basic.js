'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Licenses"
      SET plan = 'Basic'
      WHERE lower(plan) = 'free'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Tenants"
      SET plan = 'Basic'
      WHERE lower(plan) = 'free'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Licenses"
      SET plan = 'Free'
      WHERE plan = 'Basic'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Tenants"
      SET plan = 'free'
      WHERE plan = 'Basic'
    `);
  },
};
