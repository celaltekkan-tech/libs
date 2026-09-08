'use strict';


module.exports = {
async up (queryInterface, Sequelize) {
await queryInterface.createTable('Teachers', {
id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
tenant_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Tenants', key: 'id' }, onDelete: 'CASCADE' },
school_id: { type: Sequelize.INTEGER, references: { model: 'Schools', key: 'id' }, onDelete: 'SET NULL' },


// Görseldeki alanlar
city: { type: Sequelize.STRING },
district: { type: Sequelize.STRING },
personnel_no: { type: Sequelize.STRING },
national_id: { type: Sequelize.STRING },
first_name: { type: Sequelize.STRING },
last_name: { type: Sequelize.STRING },
last_graduated_school: { type: Sequelize.STRING },
class_level: { type: Sequelize.STRING },
title_branch: { type: Sequelize.STRING },


working_institution: { type: Sequelize.STRING },
degree: { type: Sequelize.STRING },
pension_degree: { type: Sequelize.STRING },
rank: { type: Sequelize.STRING },
degree_rank_date: { type: Sequelize.DATE },
school_principal: { type: Sequelize.STRING },


meta: { type: Sequelize.JSONB },


created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('now') }
});


await queryInterface.addIndex('Teachers', ['tenant_id']);
await queryInterface.addIndex('Teachers', ['school_id']);
await queryInterface.addIndex('Teachers', ['national_id']);
},


async down (queryInterface) {
await queryInterface.dropTable('Teachers');
}
};