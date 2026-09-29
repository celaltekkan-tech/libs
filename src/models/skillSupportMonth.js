module.exports = (sequelize, DataTypes) => {
  const SkillSupportMonth = sequelize.define(
    'SkillSupportMonth',
    {
      tenant_id: DataTypes.INTEGER,
      placement_id: DataTypes.INTEGER,
      year: DataTypes.INTEGER,
      month: DataTypes.INTEGER,
      work_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      amount: DataTypes.DECIMAL(12, 2),
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'bekliyor' },
      paid_at: DataTypes.DATEONLY,
      note: DataTypes.TEXT,
    },
    {
      tableName: 'SkillSupportMonths',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SkillSupportMonth.associate = function (models) {
    SkillSupportMonth.belongsTo(models.SkillPlacement, { foreignKey: 'placement_id' });
  };

  return SkillSupportMonth;
};
