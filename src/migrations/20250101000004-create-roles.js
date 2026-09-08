'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('roles', {
id: {
allowNull: false,
autoIncrement: true,
primaryKey: true,
type: Sequelize.INTEGER
},
role_name: { type: Sequelize.STRING, allowNull: false },
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});
},


async down (queryInterface) {
await queryInterface.dropTable('roles');
}
};

