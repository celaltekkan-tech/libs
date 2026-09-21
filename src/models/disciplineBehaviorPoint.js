module.exports = (sequelize, DataTypes) => {
  const DisciplineBehaviorPoint = sequelize.define(
    'DisciplineBehaviorPoint',
    {
      tenant_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      participant_id: DataTypes.INTEGER,
      decision_id: DataTypes.INTEGER,
      academic_year: { type: DataTypes.STRING, allowNull: false },
      points_deducted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      points_restored: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      restore_date: DataTypes.DATEONLY,
      reason: DataTypes.TEXT,
    },
    {
      tableName: 'DisciplineBehaviorPoints',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineBehaviorPoint.associate = function (models) {
    DisciplineBehaviorPoint.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DisciplineBehaviorPoint.belongsTo(models.Student, { foreignKey: 'student_id' });
    DisciplineBehaviorPoint.belongsTo(models.DisciplineParticipant, { foreignKey: 'participant_id', as: 'Participant' });
    DisciplineBehaviorPoint.belongsTo(models.DisciplineDecision, { foreignKey: 'decision_id' });
  };

  return DisciplineBehaviorPoint;
};
