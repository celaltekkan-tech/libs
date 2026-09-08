'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('Users', {
id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onDelete: 'CASCADE' },
school_id: { type: Sequelize.INTEGER, references: { model: 'Schools', key: 'id' }, onDelete: 'SET NULL' },
email: { type: Sequelize.STRING, allowNull: false, unique: true },
password_hash: { type: Sequelize.STRING, allowNull: false },
role: { type: Sequelize.STRING, allowNull: false, defaultValue: 'teacher' },
full_name: { type: Sequelize.STRING },
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});
},


async down (queryInterface) {
await queryInterface.dropTable('Users');
}
};