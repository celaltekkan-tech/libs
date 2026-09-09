module.exports = (sequelize, DataTypes) => {
  const DykCourse = sequelize.define(
    'DykCourse',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      subject_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      academic_year: DataTypes.STRING,
      min_attendance_rate: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 80,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'DykCourses',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DykCourse.associate = function (models) {
    DykCourse.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DykCourse.belongsTo(models.School, { foreignKey: 'school_id' });
    DykCourse.belongsTo(models.Subject, { foreignKey: 'subject_id' });
    DykCourse.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
    DykCourse.hasMany(models.DykEnrollment, { foreignKey: 'dyk_course_id' });
    DykCourse.hasMany(models.DykAttendanceRecord, { foreignKey: 'dyk_course_id' });
  };

  return DykCourse;
};
