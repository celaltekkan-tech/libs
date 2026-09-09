module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      tenant_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      user_email: DataTypes.STRING,
      user_name: DataTypes.STRING,
      action: DataTypes.STRING,
      entity_type: DataTypes.STRING,
      entity_id: DataTypes.INTEGER,
      summary: DataTypes.STRING,
      meta: DataTypes.JSONB,
      ip: DataTypes.STRING,
    },
    {
      tableName: 'AuditLogs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  AuditLog.associate = function (models) {
    AuditLog.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    AuditLog.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return AuditLog;
};
