module.exports = (sequelize, DataTypes) => {
  const BackupLog = sequelize.define(
    'BackupLog',
    {
      // backup | prune | delete | import | restore | download | config | host
      action: { type: DataTypes.STRING(20), allowNull: false },
      // scheduled | manual | host | system
      trigger: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'system' },
      // running | success | error | skipped | warning
      status: { type: DataTypes.STRING(20), allowNull: false },
      filename: { type: DataTypes.STRING(255), allowNull: true },
      size_bytes: { type: DataTypes.BIGINT, allowNull: true },
      duration_ms: { type: DataTypes.INTEGER, allowNull: true },
      backup_dir: { type: DataTypes.STRING(500), allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: true },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      user_label: { type: DataTypes.STRING(255), allowNull: true },
      started_at: { type: DataTypes.DATE, allowNull: true },
      finished_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'BackupLogs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return BackupLog;
};
