module.exports = (sequelize, DataTypes) => {
  const MessageLog = sequelize.define(
    'MessageLog',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      channel: { type: DataTypes.STRING(10), allowNull: false },
      source_module: { type: DataTypes.STRING(30), allowNull: false },
      source_id: { type: DataTypes.INTEGER, allowNull: true },
      recipient_label: { type: DataTypes.STRING(150), allowNull: true },
      recipient_contact: { type: DataTypes.STRING(150), allowNull: true },
      subject: { type: DataTypes.STRING(300), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false },
      error: { type: DataTypes.TEXT, allowNull: true },
      sent_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'MessageLogs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  MessageLog.associate = function (models) {
    MessageLog.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    MessageLog.hasMany(models.MessageLogHide, { foreignKey: 'message_log_id' });
  };

  return MessageLog;
};
