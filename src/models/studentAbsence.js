module.exports = (sequelize, DataTypes) => {
  const StudentAbsence = sequelize.define(
    'StudentAbsence',
    {
      tenant_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      absence_date: DataTypes.DATEONLY,
      is_excused: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reason: DataTypes.STRING,
    },
    {
      tableName: 'StudentAbsences',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  StudentAbsence.associate = function (models) {
    StudentAbsence.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    StudentAbsence.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return StudentAbsence;
};
