module.exports = (sequelize, DataTypes) => {
  const DutyAssignment = sequelize.define(
    'DutyAssignment',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      duty_location_id: DataTypes.INTEGER,
      duty_date: DataTypes.DATEONLY,
      notes: DataTypes.STRING,
      incident_note: DataTypes.TEXT,
    },
    {
      tableName: 'DutyAssignments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DutyAssignment.associate = function (models) {
    DutyAssignment.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DutyAssignment.belongsTo(models.School, { foreignKey: 'school_id' });
    DutyAssignment.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
    DutyAssignment.belongsTo(models.DutyLocation, { foreignKey: 'duty_location_id' });
  };

  return DutyAssignment;
};
