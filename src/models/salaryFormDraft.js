module.exports = (sequelize, DataTypes) => {
  const SalaryFormDraft = sequelize.define(
    'SalaryFormDraft',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      month: { type: DataTypes.INTEGER, allowNull: false },
      year: { type: DataTypes.INTEGER, allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      updated_by: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'SalaryFormDrafts',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SalaryFormDraft.associate = function (models) {
    SalaryFormDraft.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  };

  return SalaryFormDraft;
};
