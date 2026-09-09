// models/user.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define(
      "User",
      {
        tenant_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        school_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        full_name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        password_hash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        role: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "teacher",
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        last_login_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        is_platform_admin: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      },
      {
        tableName: "Users",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        defaultScope: {
          attributes: { exclude: ["password_hash"] },
        },
        scopes: {
          withPassword: { attributes: { include: ["password_hash"] } },
        },
      }
    );
  
    User.associate = (models) => {
      User.belongsTo(models.Tenant, { foreignKey: "tenant_id" });
      User.belongsTo(models.School, { foreignKey: "school_id" });
      User.hasMany(models.UserSchool, { foreignKey: "user_id" });
      User.hasMany(models.Feedback, { foreignKey: "user_id" });
    };
  
    return User;
  };
  