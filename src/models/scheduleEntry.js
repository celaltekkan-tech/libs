module.exports = (sequelize, DataTypes) => {
  const ScheduleEntry = sequelize.define(
    'ScheduleEntry',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      classroom_id: DataTypes.INTEGER,
      subject_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      day_of_week: DataTypes.INTEGER,
      period_no: DataTypes.INTEGER,
      academic_year: DataTypes.STRING,
    },
    {
      tableName: 'ScheduleEntries',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ScheduleEntry.associate = function (models) {
    ScheduleEntry.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ScheduleEntry.belongsTo(models.School, { foreignKey: 'school_id' });
    ScheduleEntry.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    ScheduleEntry.belongsTo(models.Subject, { foreignKey: 'subject_id' });
    ScheduleEntry.belongsTo(models.Teacher, { foreignKey: 'teacher_id', as: 'Teacher' });
  };

  return ScheduleEntry;
};
