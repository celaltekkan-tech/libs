module.exports = (sequelize, DataTypes) => {
  const AiUsageDaily = sequelize.define(
    'AiUsageDaily',
    {
      tenant_id: DataTypes.INTEGER,
      usage_date: DataTypes.DATEONLY,
      used: DataTypes.INTEGER,
    },
    {
      tableName: 'AiUsageDaily',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  AiUsageDaily.associate = function (models) {
    AiUsageDaily.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  };

  return AiUsageDaily;
};
