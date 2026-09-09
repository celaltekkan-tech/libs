module.exports = (sequelize, DataTypes) => {
  const DykEnrollment = sequelize.define(
    'DykEnrollment',
    {
      tenant_id: DataTypes.INTEGER,
      dyk_course_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
    },
    {
      tableName: 'DykEnrollments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DykEnrollment.associate = function (models) {
    DykEnrollment.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DykEnrollment.belongsTo(models.DykCourse, { foreignKey: 'dyk_course_id' });
    DykEnrollment.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return DykEnrollment;
};
