module.exports = (sequelize, DataTypes) => {
  const ResponsibilityExamItem = sequelize.define(
    'ResponsibilityExamItem',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      classroom_id: DataTypes.INTEGER,
      student_number: DataTypes.STRING,
      student_name: DataTypes.STRING,
      current_class_level: DataTypes.STRING,
      current_section: DataTypes.STRING,
      subject_class_level: DataTypes.STRING,
      subject_name: DataTypes.STRING,
      subject_id: DataTypes.INTEGER,
      exam_date: DataTypes.DATEONLY,
      start_time: DataTypes.STRING,
      oral_exam_date: DataTypes.DATEONLY,
      oral_start_time: DataTypes.STRING,
      duration_minutes: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      committee_members: DataTypes.JSONB,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'ResponsibilityExamItems',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ResponsibilityExamItem.associate = function (models) {
    ResponsibilityExamItem.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ResponsibilityExamItem.belongsTo(models.School, { foreignKey: 'school_id' });
    ResponsibilityExamItem.belongsTo(models.Student, { foreignKey: 'student_id' });
    ResponsibilityExamItem.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    ResponsibilityExamItem.belongsTo(models.Subject, { foreignKey: 'subject_id' });
    ResponsibilityExamItem.belongsTo(models.Teacher, { foreignKey: 'teacher_id', as: 'Teacher' });
  };

  return ResponsibilityExamItem;
};
