module.exports = (sequelize, DataTypes) => {
  const DutyLocation = sequelize.define(
    'DutyLocation',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      floor_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'DutyLocations',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DutyLocation.associate = function (models) {
    DutyLocation.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DutyLocation.belongsTo(models.School, { foreignKey: 'school_id' });
    DutyLocation.hasMany(models.DutyAssignment, { foreignKey: 'duty_location_id' });
  };

  return DutyLocation;
};
