module.exports = (sequelize, DataTypes) => {
  const LeaveRecord = sequelize.define(
    'LeaveRecord',
    {
      tenant_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      leave_type: DataTypes.STRING,
      start_date: DataTypes.DATEONLY,
      end_date: DataTypes.DATEONLY,
      day_count: DataTypes.INTEGER,
      reason: DataTypes.STRING,
    },
    {
      tableName: 'LeaveRecords',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  LeaveRecord.associate = function (models) {
    LeaveRecord.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    LeaveRecord.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return LeaveRecord;
};
