module.exports = (sequelize, DataTypes) => {
  const DisciplineNotification = sequelize.define(
    'DisciplineNotification',
    {
      decision_id: DataTypes.INTEGER,
      participant_id: DataTypes.INTEGER,
      notification_type: { type: DataTypes.STRING, allowNull: false },
      sent_date: DataTypes.DATEONLY,
      sanction_start_date: DataTypes.DATEONLY,
      sanction_end_date: DataTypes.DATEONLY,
      broken_behavior_point: DataTypes.INTEGER,
      remaining_behavior_point: DataTypes.INTEGER,
      acknowledged_by: DataTypes.STRING,
      acknowledged_date: DataTypes.DATEONLY,
    },
    {
      tableName: 'DisciplineNotifications',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineNotification.associate = function (models) {
    DisciplineNotification.belongsTo(models.DisciplineDecision, { foreignKey: 'decision_id' });
    DisciplineNotification.belongsTo(models.DisciplineParticipant, { foreignKey: 'participant_id', as: 'Participant' });
  };

  return DisciplineNotification;
};
