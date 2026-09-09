module.exports = (sequelize, DataTypes) => {
  const License = sequelize.define(
    'License',
    {
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      plan: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'active',
      },
      starts_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ends_at: { type: DataTypes.DATE, allowNull: true },
      cancelled_at: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'Licenses',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  License.associate = function (models) {
    License.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  };

  return License;
};
