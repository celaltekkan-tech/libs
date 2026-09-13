// models/role.js
module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      role_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'roles',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  );

  Role.associate = (models) => {
    Role.hasMany(models.UserSchool, { foreignKey: 'role_id' });
    Role.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: 'role_id',
    });
  };

  return Role;
};
