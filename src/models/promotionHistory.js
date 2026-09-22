module.exports = (sequelize, DataTypes) => {
  const PromotionHistory = sequelize.define('PromotionHistory', {
    tenant_id: DataTypes.INTEGER,
    teacher_id: DataTypes.INTEGER,
    previous_degree: DataTypes.STRING,
    previous_rank: DataTypes.STRING,
    previous_degree_rank_date: DataTypes.DATE,
    new_degree: DataTypes.STRING,
    new_rank: DataTypes.STRING,
    new_degree_rank_date: DataTypes.DATE,
    note: DataTypes.STRING,
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'manuel',
    },
    override_reason: DataTypes.STRING,
    is_permanent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: DataTypes.INTEGER,
  }, {
    tableName: 'PromotionHistories',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  PromotionHistory.associate = function (models) {
    PromotionHistory.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    PromotionHistory.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return PromotionHistory;
};
