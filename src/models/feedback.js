module.exports = (sequelize, DataTypes) => {
  const Feedback = sequelize.define(
    'Feedback',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
      page_path: { type: DataTypes.STRING(300), allowNull: true },
      page_title: { type: DataTypes.STRING(120), allowNull: true },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'new',
      },
      reply: { type: DataTypes.TEXT, allowNull: true },
      replied_at: { type: DataTypes.DATE, allowNull: true },
      cancel_reason: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'Feedbacks',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Feedback.associate = function (models) {
    Feedback.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Feedback.belongsTo(models.User, { foreignKey: 'user_id' });
    Feedback.hasMany(models.FeedbackAttachment, {
      foreignKey: 'feedback_id',
      as: 'Attachments',
    });
    Feedback.hasMany(models.FeedbackUpdate, {
      foreignKey: 'feedback_id',
      as: 'Updates',
    });
  };

  return Feedback;
};
