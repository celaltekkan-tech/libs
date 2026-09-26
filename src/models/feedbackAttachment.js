'use strict';

const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const FeedbackAttachment = sequelize.define(
    'FeedbackAttachment',
    {
      public_id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4 },
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
      hooks: {
        beforeValidate(row) {
          if (row.isNewRecord && !row.public_id) row.public_id = crypto.randomUUID();
        },
      },
    }
  );

  FeedbackAttachment.associate = function (models) {
    FeedbackAttachment.belongsTo(models.Feedback, { foreignKey: 'feedback_id' });
  };

  return FeedbackAttachment;
};
