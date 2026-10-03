module.exports = (sequelize, DataTypes) => {
  const MobileRegisterRequest = sequelize.define(
    'MobileRegisterRequest',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      school_id: { type: DataTypes.INTEGER, allowNull: false },
      national_id: { type: DataTypes.STRING(11), allowNull: false },
      first_name: { type: DataTypes.STRING(80), allowNull: false },
      last_name: { type: DataTypes.STRING(80), allowNull: false },
      phone: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
      teacher_id: { type: DataTypes.INTEGER, allowNull: true },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      reviewed_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
      reviewed_at: { type: DataTypes.DATE, allowNull: true },
      reject_reason: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'MobileRegisterRequests',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  MobileRegisterRequest.associate = (models) => {
    MobileRegisterRequest.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    MobileRegisterRequest.belongsTo(models.School, { foreignKey: 'school_id' });
    MobileRegisterRequest.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
    MobileRegisterRequest.belongsTo(models.User, { foreignKey: 'user_id' });
    MobileRegisterRequest.belongsTo(models.User, {
      foreignKey: 'reviewed_by_user_id',
      as: 'ReviewedBy',
    });
  };

  return MobileRegisterRequest;
};
