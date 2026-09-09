module.exports = (sequelize, DataTypes) => {
  const DykAttendanceRecord = sequelize.define(
    'DykAttendanceRecord',
    {
      tenant_id: DataTypes.INTEGER,
      dyk_course_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      session_date: DataTypes.DATEONLY,
      present: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'DykAttendanceRecords',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DykAttendanceRecord.associate = function (models) {
    DykAttendanceRecord.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DykAttendanceRecord.belongsTo(models.DykCourse, { foreignKey: 'dyk_course_id' });
    DykAttendanceRecord.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return DykAttendanceRecord;
};
