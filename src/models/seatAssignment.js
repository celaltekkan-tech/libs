module.exports = (sequelize, DataTypes) => {
  const SeatAssignment = sequelize.define(
    'SeatAssignment',
    {
      tenant_id: DataTypes.INTEGER,
      exam_session_id: DataTypes.INTEGER,
      exam_room_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      seat_no: DataTypes.INTEGER,
      classroom_label: DataTypes.STRING,
      present: DataTypes.BOOLEAN,
    },
    {
      tableName: 'SeatAssignments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SeatAssignment.associate = function (models) {
    SeatAssignment.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    SeatAssignment.belongsTo(models.ExamSession, { foreignKey: 'exam_session_id' });
    SeatAssignment.belongsTo(models.ExamRoom, { foreignKey: 'exam_room_id' });
    SeatAssignment.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return SeatAssignment;
};
