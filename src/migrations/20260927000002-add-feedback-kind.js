'use strict';

/** Geri bildirim ve teknik destek aynı tabloda; kind ile ayrılır. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Feedbacks', 'kind', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'feedback',
    });
    await queryInterface.addIndex('Feedbacks', ['kind'], { name: 'feedbacks_kind_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Feedbacks', 'feedbacks_kind_idx');
    await queryInterface.removeColumn('Feedbacks', 'kind');
  },
};
