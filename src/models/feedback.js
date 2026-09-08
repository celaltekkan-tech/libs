module.exports = (sequelize, DataTypes) => {
  const Feedback = sequelize.define(
    'Feedback',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'new',
      },
    },
    {
      tableName: 'Feedbacks',
      underscored: true,
    }
  );

  Feedback.associate = function (models) {
    Feedback.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Feedback.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return Feedback;
};
