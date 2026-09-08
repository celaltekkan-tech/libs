// models/rolePermission.js
module.exports = (sequelize, DataTypes) => {
    const RolePermission = sequelize.define(
      "RolePermission",
      {
        role_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        permission_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      },
      {
        tableName: "role_permissions",
        timestamps: true,
        underscored: true,
      }
    );
  
    return RolePermission;
  };
  