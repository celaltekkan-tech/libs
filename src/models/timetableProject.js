module.exports = (sequelize, DataTypes) => {
  const TimetableProject = sequelize.define(
    'TimetableProject',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      academic_year: DataTypes.STRING,
      days: DataTypes.JSONB,
      periods_per_day: DataTypes.INTEGER,
      lunch_after: DataTypes.INTEGER,
      settings: DataTypes.JSONB,
      status: DataTypes.STRING,
      published_at: DataTypes.DATE,
      created_by: DataTypes.INTEGER,
    },
    {
      tableName: 'TimetableProjects',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableProject.associate = function (models) {
    TimetableProject.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    TimetableProject.belongsTo(models.School, { foreignKey: 'school_id' });
    TimetableProject.hasMany(models.TimetableAssignment, { foreignKey: 'project_id' });
    TimetableProject.hasMany(models.TimetableConstraint, { foreignKey: 'project_id' });
    TimetableProject.hasMany(models.TimetableRun, { foreignKey: 'project_id' });
    TimetableProject.hasMany(models.TimetableLesson, { foreignKey: 'project_id' });
  };

  return TimetableProject;
};
