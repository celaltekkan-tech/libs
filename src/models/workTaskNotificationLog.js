module.exports = (sequelize, DataTypes) => {
  const WorkTaskNotificationLog = sequelize.define(
    'WorkTaskNotificationLog',
    {
      work_task_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      channel: { type: DataTypes.STRING(20), allowNull: false },
      kind: { type: DataTypes.STRING(20), allowNull: false },
      occurrence_due_at: { type: DataTypes.DATE, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false },
      error: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'WorkTaskNotificationLogs',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  WorkTaskNotificationLog.associate = function (models) {
    WorkTaskNotificationLog.belongsTo(models.WorkTask, { foreignKey: 'work_task_id' });
    WorkTaskNotificationLog.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return WorkTaskNotificationLog;
};
