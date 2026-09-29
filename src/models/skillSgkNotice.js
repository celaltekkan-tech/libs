module.exports = (sequelize, DataTypes) => {
  const SkillSgkNotice = sequelize.define(
    'SkillSgkNotice',
    {
      tenant_id: DataTypes.INTEGER,
      placement_id: DataTypes.INTEGER,
      kind: DataTypes.STRING(16),
      notice_date: DataTypes.DATEONLY,
      sgk_ref: DataTypes.STRING,
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'taslak' },
      note: DataTypes.TEXT,
    },
    {
      tableName: 'SkillSgkNotices',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SkillSgkNotice.associate = function (models) {
    SkillSgkNotice.belongsTo(models.SkillPlacement, { foreignKey: 'placement_id' });
  };

  return SkillSgkNotice;
};
