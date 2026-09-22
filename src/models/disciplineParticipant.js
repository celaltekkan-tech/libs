module.exports = (sequelize, DataTypes) => {
  const DisciplineParticipant = sequelize.define(
    'DisciplineParticipant',
    {
      incident_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      role: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'kayitli' },
      health_status: DataTypes.TEXT,
      economic_status_mother: DataTypes.STRING,
      economic_status_father: DataTypes.STRING,
      family_together: DataTypes.STRING,
      parents_alive: DataTypes.STRING,
      parents_biological: DataTypes.STRING,
      raised_environment: DataTypes.TEXT,
      family_address: DataTypes.TEXT,
      notes: DataTypes.TEXT,
    },
    {
      tableName: 'DisciplineParticipants',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineParticipant.associate = function (models) {
    DisciplineParticipant.belongsTo(models.DisciplineIncident, { foreignKey: 'incident_id', as: 'Incident' });
    DisciplineParticipant.belongsTo(models.Student, { foreignKey: 'student_id' });
    DisciplineParticipant.hasMany(models.DisciplineStatement, { foreignKey: 'participant_id' });
    DisciplineParticipant.hasMany(models.DisciplineInfoRequest, { foreignKey: 'participant_id' });
    DisciplineParticipant.hasMany(models.DisciplineDecision, { foreignKey: 'participant_id' });
    DisciplineParticipant.hasMany(models.DisciplineBehaviorPoint, { foreignKey: 'participant_id' });
  };

  return DisciplineParticipant;
};
