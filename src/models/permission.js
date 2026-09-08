// models/permission.js
module.exports = (sequelize, DataTypes) => {
    const Permission = sequelize.define(
      "Permission",
      {
        permission_key: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        description: DataTypes.STRING,
      },
      {
        tableName: "permissions",
        timestamps: true,
        underscored: true,
      }
    );
  
    Permission.associate = (models) => {
      Permission.belongsToMany(models.Role, {
        through: models.RolePermission,
        foreignKey: "permission_id",
      });
    };
  
    return Permission;
  };
  