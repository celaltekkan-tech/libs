module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      recipient_user_id: { type: DataTypes.INTEGER, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: true },
      sender_user_id: { type: DataTypes.INTEGER, allowNull: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      read_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'Notifications',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Notification.associate = function (models) {
    Notification.belongsTo(models.User, { foreignKey: 'recipient_user_id', as: 'Recipient' });
    Notification.belongsTo(models.User, { foreignKey: 'sender_user_id', as: 'Sender' });
    Notification.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  };

  return Notification;
};
