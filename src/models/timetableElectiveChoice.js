module.exports = (sequelize, DataTypes) => {
  const TimetableElectiveChoice = sequelize.define(
    'TimetableElectiveChoice',
    {
      tenant_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      assignment_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
    },
    {
      tableName: 'TimetableElectiveChoices',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableElectiveChoice.associate = function (models) {
    TimetableElectiveChoice.belongsTo(models.TimetableAssignment, { foreignKey: 'assignment_id' });
    TimetableElectiveChoice.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return TimetableElectiveChoice;
};
