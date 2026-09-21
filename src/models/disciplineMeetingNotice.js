module.exports = (sequelize, DataTypes) => {
  const DisciplineMeetingNotice = sequelize.define(
    'DisciplineMeetingNotice',
    {
      incident_id: DataTypes.INTEGER,
      participant_id: DataTypes.INTEGER,
      notice_type: { type: DataTypes.STRING, allowNull: false },
      meeting_date: DataTypes.DATEONLY,
      meeting_time: DataTypes.STRING,
      location: DataTypes.STRING,
      agenda: DataTypes.TEXT,
      board_members: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      acknowledged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      acknowledged_date: DataTypes.DATEONLY,
    },
    {
      tableName: 'DisciplineMeetingNotices',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineMeetingNotice.associate = function (models) {
    DisciplineMeetingNotice.belongsTo(models.DisciplineIncident, { foreignKey: 'incident_id' });
    DisciplineMeetingNotice.belongsTo(models.DisciplineParticipant, { foreignKey: 'participant_id', as: 'Participant' });
  };

  return DisciplineMeetingNotice;
};
