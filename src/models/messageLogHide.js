module.exports = (sequelize, DataTypes) => {
  const MessageLogHide = sequelize.define(
    'MessageLogHide',
    {
      message_log_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'MessageLogHides',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  MessageLogHide.associate = function (models) {
    MessageLogHide.belongsTo(models.MessageLog, { foreignKey: 'message_log_id' });
    MessageLogHide.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return MessageLogHide;
};
