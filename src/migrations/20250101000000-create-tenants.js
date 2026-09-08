'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('Tenants', {
id: {
allowNull: false,
autoIncrement: true,
primaryKey: true,
type: Sequelize.INTEGER
},
name: { type: Sequelize.STRING, allowNull: false },
stripe_customer_id: { type: Sequelize.STRING },
plan: { type: Sequelize.STRING, defaultValue: 'free' },
data: { type: Sequelize.JSONB },
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});
},


async down (queryInterface) {
await queryInterface.dropTable('Tenants');
}
};