module.exports = (sequelize, DataTypes) => {
  const Holiday = sequelize.define(
    'Holiday',
    {
      tenant_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      month: DataTypes.INTEGER,
      day: DataTypes.INTEGER,
      year: DataTypes.INTEGER,
    },
    {
      tableName: 'Holidays',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Holiday.associate = function (models) {
    Holiday.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  };

  return Holiday;
};
