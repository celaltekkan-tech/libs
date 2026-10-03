module.exports = (sequelize, DataTypes) => {
  const DemoResetSetting = sequelize.define(
    'DemoResetSetting',
    {
      schedule_time: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '03:00' },
      snapshot: { type: DataTypes.JSONB, allowNull: true },
      snapshot_taken_at: { type: DataTypes.DATE, allowNull: true },
      last_reset_at: { type: DataTypes.DATE, allowNull: true },
      last_reset_trigger: { type: DataTypes.STRING(20), allowNull: true },
      last_reset_summary: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: 'DemoResetSettings',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return DemoResetSetting;
};
