module.exports = (sequelize, DataTypes) => {
  const WorkTask = sequelize.define(
    'WorkTask',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(300), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      assignee_user_id: { type: DataTypes.INTEGER, allowNull: false },
      created_by: { type: DataTypes.INTEGER, allowNull: true },
      frequency: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'once' },
      recurrence_config: { type: DataTypes.JSONB, allowNull: true },
      next_due_at: { type: DataTypes.DATE, allowNull: false },
      remind_before_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1440 },
      is_mandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      notify_channels: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
      last_completed_at: { type: DataTypes.DATE, allowNull: true },
      last_reminder_at: { type: DataTypes.DATE, allowNull: true },
      last_overdue_notice_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'WorkTasks',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  WorkTask.associate = function (models) {
    WorkTask.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    WorkTask.belongsTo(models.User, { foreignKey: 'assignee_user_id', as: 'Assignee' });
    WorkTask.belongsTo(models.User, { foreignKey: 'created_by', as: 'Creator' });
    WorkTask.hasMany(models.WorkTaskNotificationLog, { foreignKey: 'work_task_id', as: 'NotificationLogs' });
  };

  return WorkTask;
};
