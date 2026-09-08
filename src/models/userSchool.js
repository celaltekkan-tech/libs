// models/userSchool.js
module.exports = (sequelize, DataTypes) => {
    const UserSchool = sequelize.define(
      "UserSchool",
      {
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        school_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        role_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      },
      {
        tableName: "users_schools",
        timestamps: true,
        underscored: true,
      }
    );
  
    UserSchool.associate = (models) => {
      UserSchool.belongsTo(models.User, { foreignKey: "user_id" });
      UserSchool.belongsTo(models.School, { foreignKey: "school_id" });
      UserSchool.belongsTo(models.Role, { foreignKey: "role_id" });
    };
  
    return UserSchool;
  };
  