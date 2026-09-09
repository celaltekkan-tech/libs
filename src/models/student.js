module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define(
    'Student',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      classroom_id: DataTypes.INTEGER,
      student_number: DataTypes.STRING,
      national_id: DataTypes.STRING,
      first_name: DataTypes.STRING,
      last_name: DataTypes.STRING,
      class_level: DataTypes.STRING,
      section: DataTypes.STRING,
      gender: DataTypes.STRING(1),
      birth_date: DataTypes.DATEONLY,
      registration_status: DataTypes.STRING,
      parent_name: DataTypes.STRING,
      parent_phone: DataTypes.STRING,
      extra_contacts: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_inclusion: DataTypes.BOOLEAN,
      is_foreign: DataTypes.BOOLEAN,
      meta: DataTypes.JSONB,
    },
    {
      tableName: 'Students',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Student.associate = function (models) {
    Student.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Student.belongsTo(models.School, { foreignKey: 'school_id' });
    Student.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    Student.hasMany(models.StudentAbsence, { foreignKey: 'student_id' });
    Student.hasMany(models.DykEnrollment, { foreignKey: 'student_id' });
    Student.hasMany(models.DykAttendanceRecord, { foreignKey: 'student_id' });
    Student.hasMany(models.ParentConsent, { foreignKey: 'student_id' });
    Student.hasMany(models.SeatAssignment, { foreignKey: 'student_id' });
    Student.hasMany(models.DisciplinaryCase, { foreignKey: 'student_id' });
    Student.hasMany(models.GuidanceSession, { foreignKey: 'student_id' });
  };

  return Student;
};
