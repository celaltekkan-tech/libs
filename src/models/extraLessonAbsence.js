module.exports = (sequelize, DataTypes) => {
  const ExtraLessonAbsence = sequelize.define(
    'ExtraLessonAbsence',
    {
      tenant_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      absence_date: DataTypes.DATEONLY,
      reason: DataTypes.STRING(30),
      missed_hours: DataTypes.DECIMAL(4, 1),
      note: DataTypes.STRING(300),
    },
    {
      tableName: 'ExtraLessonAbsences',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ExtraLessonAbsence.associate = function (models) {
    ExtraLessonAbsence.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ExtraLessonAbsence.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return ExtraLessonAbsence;
};
