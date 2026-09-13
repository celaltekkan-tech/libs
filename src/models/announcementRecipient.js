module.exports = (sequelize, DataTypes) => {
  const AnnouncementRecipient = sequelize.define(
    'AnnouncementRecipient',
    {
      announcement_id: { type: DataTypes.INTEGER, allowNull: false },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      student_id: { type: DataTypes.INTEGER, allowNull: true },
      phone_number: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'beklemede',
      },
      provider: { type: DataTypes.STRING, allowNull: true },
      provider_message_id: { type: DataTypes.STRING, allowNull: true },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      sent_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'AnnouncementRecipients',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  AnnouncementRecipient.associate = function (models) {
    AnnouncementRecipient.belongsTo(models.Announcement, { foreignKey: 'announcement_id' });
    AnnouncementRecipient.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    AnnouncementRecipient.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return AnnouncementRecipient;
};
