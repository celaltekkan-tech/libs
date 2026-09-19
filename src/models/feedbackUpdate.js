module.exports = (sequelize, DataTypes) => {
  const FeedbackUpdate = sequelize.define(
    'FeedbackUpdate',
    {
      feedback_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      is_from_platform: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: 'FeedbackUpdates',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  FeedbackUpdate.associate = function (models) {
    FeedbackUpdate.belongsTo(models.Feedback, { foreignKey: 'feedback_id' });
    FeedbackUpdate.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return FeedbackUpdate;
};
