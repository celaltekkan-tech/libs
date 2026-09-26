const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const FeedbackUpdate = sequelize.define(
    'FeedbackUpdate',
    {
      public_id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4 },
      feedback_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      is_from_platform: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      author_name: { type: DataTypes.STRING(200), allowNull: true },
    },
    {
      tableName: 'FeedbackUpdates',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      hooks: {
        beforeValidate(row) {
          if (row.isNewRecord && !row.public_id) row.public_id = crypto.randomUUID();
        },
      },
    }
  );

  FeedbackUpdate.associate = function (models) {
    FeedbackUpdate.belongsTo(models.Feedback, { foreignKey: 'feedback_id' });
    FeedbackUpdate.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return FeedbackUpdate;
};
