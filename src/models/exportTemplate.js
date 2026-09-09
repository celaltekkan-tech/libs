module.exports = (sequelize, DataTypes) => {
  const ExportTemplate = sequelize.define(
    'ExportTemplate',
    {
      tenant_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      entity_type: DataTypes.STRING,
      name: DataTypes.STRING,
      columns: DataTypes.JSONB,
      filters: DataTypes.JSONB,
    },
    {
      tableName: 'ExportTemplates',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ExportTemplate.associate = function (models) {
    ExportTemplate.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ExportTemplate.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return ExportTemplate;
};
