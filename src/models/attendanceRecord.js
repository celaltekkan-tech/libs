module.exports = (sequelize, DataTypes) => {
  const AttendanceRecord = sequelize.define(
    'AttendanceRecord',
    {
      tenant_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      attendance_date: DataTypes.DATEONLY,
      status: DataTypes.STRING,
      overtime_hours: DataTypes.DECIMAL(5, 2),
      notes: DataTypes.STRING,
    },
    {
      tableName: 'AttendanceRecords',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  AttendanceRecord.associate = function (models) {
    AttendanceRecord.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    AttendanceRecord.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return AttendanceRecord;
};
