'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('users_schools', {
id: {
allowNull: false,
autoIncrement: true,
primaryKey: true,
type: Sequelize.INTEGER
},
user_id: { 
type: Sequelize.INTEGER, 
allowNull: false, 
references: { model: 'Users', key: 'id' }, 
onDelete: 'CASCADE' 
},
school_id: { 
type: Sequelize.INTEGER, 
allowNull: false, 
references: { model: 'Schools', key: 'id' }, 
onDelete: 'CASCADE' 
},
role_id: { 
type: Sequelize.INTEGER, 
allowNull: false, 
references: { model: 'roles', key: 'id' }, 
onDelete: 'CASCADE' 
},
created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});


await queryInterface.addIndex('users_schools', ['user_id']);
await queryInterface.addIndex('users_schools', ['school_id']);
await queryInterface.addIndex('users_schools', ['role_id']);
},


async down (queryInterface) {
await queryInterface.dropTable('users_schools');
}
};


