module.exports = (sequelize, DataTypes) => {
  const LegalTimestampLog = sequelize.define(
    'LegalTimestampLog',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      school_id: { type: DataTypes.INTEGER, allowNull: true },
      request_id: { type: DataTypes.INTEGER, allowNull: true },
      event_type: { type: DataTypes.STRING(80), allowNull: false },
      actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
      actor_name: { type: DataTypes.STRING(120), allowNull: true },
      actor_email: { type: DataTypes.STRING, allowNull: true },
      payload: { type: DataTypes.JSONB, allowNull: false },
      canonical_json: { type: DataTypes.TEXT, allowNull: false },
      content_hash: { type: DataTypes.STRING(64), allowNull: false },
      hash_algorithm: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'SHA-256' },
      timestamp_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
      timestamp_token: { type: DataTypes.TEXT, allowNull: true },
      timestamped_at: { type: DataTypes.DATE, allowNull: true },
      ip: { type: DataTypes.STRING(64), allowNull: true },
      user_agent: { type: DataTypes.STRING(400), allowNull: true },
    },
    {
      tableName: 'LegalTimestampLogs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  LegalTimestampLog.associate = (models) => {
    LegalTimestampLog.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    LegalTimestampLog.belongsTo(models.School, { foreignKey: 'school_id' });
    LegalTimestampLog.belongsTo(models.MobileRegisterRequest, { foreignKey: 'request_id' });
    LegalTimestampLog.belongsTo(models.User, { foreignKey: 'actor_user_id', as: 'Actor' });
  };

  return LegalTimestampLog;
};
