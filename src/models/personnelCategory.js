module.exports = (sequelize, DataTypes) => {
  const PersonnelCategory = sequelize.define(
    'PersonnelCategory',
    {
      tenant_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      code: DataTypes.STRING,
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'PersonnelCategories',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  PersonnelCategory.associate = function (models) {
    PersonnelCategory.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    PersonnelCategory.hasMany(models.Teacher, { foreignKey: 'personnel_category_id' });
  };

  return PersonnelCategory;
};
