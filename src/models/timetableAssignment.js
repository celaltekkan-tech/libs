module.exports = (sequelize, DataTypes) => {
  const TimetableAssignment = sequelize.define(
    'TimetableAssignment',
    {
      tenant_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      classroom_id: DataTypes.INTEGER,
      subject_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      weekly_hours: DataTypes.INTEGER,
      block_pattern: DataTypes.STRING,
      room_id: DataTypes.INTEGER,
      sync_group: DataTypes.STRING,
    },
    {
      tableName: 'TimetableAssignments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableAssignment.associate = function (models) {
    TimetableAssignment.belongsTo(models.TimetableProject, { foreignKey: 'project_id' });
    TimetableAssignment.belongsTo(models.Classroom, { foreignKey: 'classroom_id' });
    TimetableAssignment.belongsTo(models.Subject, { foreignKey: 'subject_id' });
    TimetableAssignment.belongsTo(models.Teacher, { foreignKey: 'teacher_id', as: 'Teacher' });
    TimetableAssignment.belongsTo(models.TimetableRoom, { foreignKey: 'room_id', as: 'Room' });
    TimetableAssignment.hasMany(models.TimetableLesson, { foreignKey: 'assignment_id' });
  };

  return TimetableAssignment;
};
