module.exports = (sequelize, DataTypes) => {
  const Announcement = sequelize.define(
    'Announcement',
    {
      tenant_id: DataTypes.INTEGER,
      created_by: DataTypes.INTEGER,
      title: DataTypes.STRING,
      body: DataTypes.TEXT,
      channel: DataTypes.STRING,
      target_type: DataTypes.STRING,
      target_ids: DataTypes.JSONB,
      recipient_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'taslak',
      },
      sent_at: DataTypes.DATE,
    },
    {
      tableName: 'Announcements',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Announcement.associate = function (models) {
    Announcement.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Announcement.belongsTo(models.User, { foreignKey: 'created_by' });
  };

  return Announcement;
};
