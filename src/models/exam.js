module.exports = (sequelize, DataTypes) => {
  const Exam = sequelize.define(
    'Exam',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      classroom_id: DataTypes.INTEGER,
      subject_id: DataTypes.INTEGER,
      exam_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'yazili',
      },
      exam_date: DataTypes.DATEONLY,
      start_time: DataTypes.STRING,
      duration_minutes: DataTypes.INTEGER,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'Exams',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Exam.associate = function (models) {
    Exam.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Exam.belongsTo(models.School, { foreignKey: 'school_id' });
    Exam.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    Exam.belongsTo(models.Subject, { foreignKey: 'subject_id' });
  };

  return Exam;
};
