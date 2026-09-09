module.exports = (sequelize, DataTypes) => {
  const NormPosition = sequelize.define(
    'NormPosition',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      title_branch: DataTypes.STRING,
      quota_count: DataTypes.INTEGER,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'NormPositions',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  NormPosition.associate = function (models) {
    NormPosition.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    NormPosition.belongsTo(models.School, { foreignKey: 'school_id' });
  };

  return NormPosition;
};
