'use strict';

module.exports = (sequelize, DataTypes) => {
  const FeedbackAttachment = sequelize.define(
    'FeedbackAttachment',
    {
      feedback_id: { type: DataTypes.INTEGER, allowNull: false },
      original_name: { type: DataTypes.STRING, allowNull: false },
      stored_name: { type: DataTypes.STRING, allowNull: false },
      mime_type: { type: DataTypes.STRING, allowNull: false },
      size_bytes: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'FeedbackAttachments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  FeedbackAttachment.associate = function (models) {
    FeedbackAttachment.belongsTo(models.Feedback, { foreignKey: 'feedback_id' });
  };

  return FeedbackAttachment;
};
