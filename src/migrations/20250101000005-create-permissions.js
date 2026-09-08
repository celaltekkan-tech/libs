'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('permissions', {
id: {
allowNull: false,
autoIncrement: true,
primaryKey: true,
type: Sequelize.INTEGER
},
permission_key: { type: Sequelize.STRING, allowNull: false, unique: true },
description: { type: Sequelize.STRING },
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});
},


async down (queryInterface) {
await queryInterface.dropTable('permissions');
}
};


