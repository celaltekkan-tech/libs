module.exports = (sequelize, DataTypes) => {
  const DisciplineStatement = sequelize.define(
    'DisciplineStatement',
    {
      incident_id: DataTypes.INTEGER,
      participant_id: DataTypes.INTEGER,
      statement_type: { type: DataTypes.STRING, allowNull: false },
      content: DataTypes.TEXT,
      taken_by: DataTypes.STRING,
      written_by: DataTypes.STRING,
      taken_at: DataTypes.DATEONLY,
      location: DataTypes.STRING,
      questions: DataTypes.JSONB,
      student_home_phone: DataTypes.STRING,
      student_mobile_phone: DataTypes.STRING,
      student_home_address: DataTypes.TEXT,
      guardian_work_phone: DataTypes.STRING,
      guardian_mobile_phone: DataTypes.STRING,
      guardian_work_address: DataTypes.TEXT,
    },
    {
      tableName: 'DisciplineStatements',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineStatement.associate = function (models) {
    DisciplineStatement.belongsTo(models.DisciplineIncident, { foreignKey: 'incident_id' });
    DisciplineStatement.belongsTo(models.DisciplineParticipant, { foreignKey: 'participant_id', as: 'Participant' });
  };

  return DisciplineStatement;
};
