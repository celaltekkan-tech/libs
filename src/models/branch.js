module.exports = (sequelize, DataTypes) => {
  const Branch = sequelize.define(
    'Branch',
    {
      tenant_id: DataTypes.INTEGER,
      code: DataTypes.STRING,
      name: DataTypes.STRING,
    },
    {
      tableName: 'Branches',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Branch.associate = function (models) {
    Branch.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Branch.hasMany(models.Subject, { foreignKey: 'branch_id' });
  };

  return Branch;
};
