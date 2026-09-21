module.exports = (sequelize, DataTypes) => {
  const DisciplineDecision = sequelize.define(
    'DisciplineDecision',
    {
      incident_id: DataTypes.INTEGER,
      participant_id: DataTypes.INTEGER,
      decision_no: DataTypes.STRING,
      decision_date: DataTypes.DATEONLY,
      prior_sanctions_summary: DataTypes.TEXT,
      behavior_date: DataTypes.DATEONLY,
      behavior_place: DataTypes.STRING,
      behavior_type: DataTypes.STRING,
      behavior_reason: DataTypes.TEXT,
      statements_summary: DataTypes.TEXT,
      mitigating_aggravating_factors: DataTypes.TEXT,
      board_opinion: DataTypes.TEXT,
      regulation_article_id: DataTypes.INTEGER,
      regulation_article_text: DataTypes.STRING,
      sanction_type: DataTypes.STRING,
      sanction_days: DataTypes.INTEGER,
      board_members: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      board_decision: DataTypes.TEXT,
      approved_by: DataTypes.STRING,
      approved_date: DataTypes.DATEONLY,
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'taslak' },
    },
    {
      tableName: 'DisciplineDecisions',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineDecision.associate = function (models) {
    DisciplineDecision.belongsTo(models.DisciplineIncident, { foreignKey: 'incident_id' });
    DisciplineDecision.belongsTo(models.DisciplineParticipant, { foreignKey: 'participant_id', as: 'Participant' });
    DisciplineDecision.belongsTo(models.DisciplineRegulationArticle, { foreignKey: 'regulation_article_id', as: 'RegulationArticle' });
    DisciplineDecision.hasMany(models.DisciplineNotification, { foreignKey: 'decision_id' });
    DisciplineDecision.hasMany(models.DisciplineBehaviorPoint, { foreignKey: 'decision_id' });
  };

  return DisciplineDecision;
};
