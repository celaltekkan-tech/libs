module.exports = (sequelize, DataTypes) => {
  const BackupSetting = sequelize.define(
    'BackupSetting',
    {
      retention_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      backup_dir: { type: DataTypes.STRING(500), allowNull: false, defaultValue: 'backups' },
      schedule_time: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '03:30' },
      last_run_at: { type: DataTypes.DATE, allowNull: true },
      last_run_status: { type: DataTypes.STRING(20), allowNull: true },
      last_run_message: { type: DataTypes.TEXT, allowNull: true },
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
