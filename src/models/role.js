// models/role.js
module.exports = (sequelize, DataTypes) => {
    const Role = sequelize.define(
      "Role",
      {
        role_name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        tableName: "roles",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
  
    Role.associate = (models) => {
      Role.hasMany(models.UserSchool, { foreignKey: "role_id" });
      Role.belongsToMany(models.Permission, {
        through: models.RolePermission,
        foreignKey: "role_id",
      });
    };
  
    return Role;
  };
  