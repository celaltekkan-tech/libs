module.exports = (sequelize, DataTypes) => {
  const Subject = sequelize.define(
    'Subject',
    {
      tenant_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      code: DataTypes.STRING,
      difficulty_level: DataTypes.STRING,
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'Subjects',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Subject.associate = function (models) {
    Subject.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Subject.hasMany(models.ScheduleEntry, { foreignKey: 'subject_id' });
    Subject.hasMany(models.DykCourse, { foreignKey: 'subject_id' });
    Subject.hasMany(models.Exam, { foreignKey: 'subject_id' });
    Subject.hasMany(models.SubjectClassHour, { foreignKey: 'subject_id', as: 'ClassHours' });
  };

  return Subject;
};
