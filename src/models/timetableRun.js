module.exports = (sequelize, DataTypes) => {
  const TimetableRun = sequelize.define(
    'TimetableRun',
    {
      tenant_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      status: DataTypes.STRING,
      job_id: DataTypes.STRING,
      time_limit: DataTypes.INTEGER,
      solver_status: DataTypes.STRING,
      objective: DataTypes.FLOAT,
      best_bound: DataTypes.FLOAT,
      progress: DataTypes.JSONB,
      result: DataTypes.JSONB,
      diagnostics: DataTypes.JSONB,
      error: DataTypes.TEXT,
      started_at: DataTypes.DATE,
      finished_at: DataTypes.DATE,
      applied_at: DataTypes.DATE,
      created_by: DataTypes.INTEGER,
    },
    {
      tableName: 'TimetableRuns',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableRun.associate = function (models) {
    TimetableRun.belongsTo(models.TimetableProject, { foreignKey: 'project_id' });
  };

  return TimetableRun;
};
