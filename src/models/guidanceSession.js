module.exports = (sequelize, DataTypes) => {
  const GuidanceSession = sequelize.define(
    'GuidanceSession',
    {
      tenant_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      created_by: DataTypes.INTEGER,
      session_date: DataTypes.DATEONLY,
      session_type: DataTypes.STRING,
      summary: DataTypes.TEXT,
      referral_to: DataTypes.STRING,
    },
    {
      tableName: 'GuidanceSessions',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  GuidanceSession.associate = function (models) {
    GuidanceSession.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    GuidanceSession.belongsTo(models.Student, { foreignKey: 'student_id' });
    GuidanceSession.belongsTo(models.User, { foreignKey: 'created_by' });
  };

  return GuidanceSession;
};
