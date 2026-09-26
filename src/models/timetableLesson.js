module.exports = (sequelize, DataTypes) => {
  const TimetableLesson = sequelize.define(
    'TimetableLesson',
    {
      tenant_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      assignment_id: DataTypes.INTEGER,
      day_of_week: DataTypes.INTEGER,
      period_no: DataTypes.INTEGER,
      room_id: DataTypes.INTEGER,
      is_locked: DataTypes.BOOLEAN,
    },
    {
      tableName: 'TimetableLessons',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableLesson.associate = function (models) {
    TimetableLesson.belongsTo(models.TimetableProject, { foreignKey: 'project_id' });
    TimetableLesson.belongsTo(models.TimetableAssignment, { foreignKey: 'assignment_id', as: 'Assignment' });
  };

  return TimetableLesson;
};
