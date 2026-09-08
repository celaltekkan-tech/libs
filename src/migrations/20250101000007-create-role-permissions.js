'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('role_permissions', {
id: {
allowNull: false,
autoIncrement: true,
primaryKey: true,
type: Sequelize.INTEGER
},
role_id: { 
type: Sequelize.INTEGER, 
allowNull: false, 
references: { model: 'roles', key: 'id' }, 
onDelete: 'CASCADE' 
},
permission_id: { 
type: Sequelize.INTEGER, 
allowNull: false, 
references: { model: 'permissions', key: 'id' }, 
onDelete: 'CASCADE' 
},
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});


await queryInterface.addIndex('role_permissions', ['role_id']);
await queryInterface.addIndex('role_permissions', ['permission_id']);


await queryInterface.addConstraint('role_permissions', {
fields: ['role_id', 'permission_id'],
type: 'unique',
name: 'unique_role_permission'
});
},


async down (queryInterface) {
await queryInterface.dropTable('role_permissions');
}
};


