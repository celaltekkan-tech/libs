'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('Schools', {
id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onDelete: 'CASCADE' },
name: { type: Sequelize.STRING, allowNull: false },
code: { type: Sequelize.STRING, unique: true, allowNull: false },
meta: { type: Sequelize.JSONB },
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});
},


async down (queryInterface) {
await queryInterface.dropTable('Schools');
}
};