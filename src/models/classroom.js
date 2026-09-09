module.exports = (sequelize, DataTypes) => {
  const Classroom = sequelize.define(
    'Classroom',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      class_level: DataTypes.STRING,
      section: DataTypes.STRING,
      teacher_id: DataTypes.INTEGER,
      academic_year: DataTypes.STRING,
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'Classrooms',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Classroom.associate = function (models) {
    Classroom.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Classroom.belongsTo(models.School, { foreignKey: 'school_id' });
    Classroom.belongsTo(models.Teacher, { foreignKey: 'teacher_id', as: 'Teacher' });
    Classroom.hasMany(models.Student, { foreignKey: 'classroom_id' });
    Classroom.hasMany(models.ScheduleEntry, { foreignKey: 'classroom_id' });
    Classroom.hasMany(models.Exam, { foreignKey: 'classroom_id' });
  };

  Classroom.prototype.displayName = function () {
    return `${this.class_level}/${this.section}`;
  };

  return Classroom;
};
