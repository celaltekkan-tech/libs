module.exports = (sequelize, DataTypes) => {
  const DisciplineInfoRequest = sequelize.define(
    'DisciplineInfoRequest',
    {
      incident_id: DataTypes.INTEGER,
      participant_id: DataTypes.INTEGER,
      source_type: { type: DataTypes.STRING, allowNull: false },
      source_name: DataTypes.STRING,
      source_branch: DataTypes.STRING,
      content: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      response_date: DataTypes.DATEONLY,
    },
    {
      tableName: 'DisciplineInfoRequests',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineInfoRequest.associate = function (models) {
    DisciplineInfoRequest.belongsTo(models.DisciplineIncident, { foreignKey: 'incident_id' });
    DisciplineInfoRequest.belongsTo(models.DisciplineParticipant, { foreignKey: 'participant_id', as: 'Participant' });
  };

  return DisciplineInfoRequest;
};
