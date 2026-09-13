module.exports = (sequelize, DataTypes) => {
  const BackupSetting = sequelize.define(
    'BackupSetting',
    {
      retention_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      updated_by: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'BackupSettings',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  BackupSetting.associate = function (models) {
    BackupSetting.belongsTo(models.User, { foreignKey: 'updated_by' });
  };

  return BackupSetting;
};
