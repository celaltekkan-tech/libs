'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('DisciplineRegulationArticles', 'article_no', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('DisciplineRegulationArticles', 'article_no', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
