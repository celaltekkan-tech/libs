module.exports = (sequelize, DataTypes) => {
  const ParentConsent = sequelize.define(
    'ParentConsent',
    {
      tenant_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      consent_type: DataTypes.STRING,
      granted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      granted_at: DataTypes.DATE,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'ParentConsents',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ParentConsent.associate = function (models) {
    ParentConsent.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ParentConsent.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return ParentConsent;
};
