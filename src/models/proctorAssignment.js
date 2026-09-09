module.exports = (sequelize, DataTypes) => {
  const ProctorAssignment = sequelize.define(
    'ProctorAssignment',
    {
      tenant_id: DataTypes.INTEGER,
      exam_session_id: DataTypes.INTEGER,
      exam_room_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
    },
    {
      tableName: 'ProctorAssignments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ProctorAssignment.associate = function (models) {
    ProctorAssignment.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ProctorAssignment.belongsTo(models.ExamSession, { foreignKey: 'exam_session_id' });
    ProctorAssignment.belongsTo(models.ExamRoom, { foreignKey: 'exam_room_id' });
    ProctorAssignment.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return ProctorAssignment;
};
