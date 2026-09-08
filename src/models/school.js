// models/school.js
module.exports = (sequelize, DataTypes) => {
    const School = sequelize.define(
      "School",
      {
        tenant_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        code: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        meta: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
      },
      {
        tableName: "Schools",
        timestamps: true,
        underscored: true,
      }
    );
  
    School.associate = (models) => {
      School.belongsTo(models.Tenant, { foreignKey: "tenant_id" });
      School.hasMany(models.UserSchool, { foreignKey: "school_id" });
      School.hasMany(models.Teacher, { foreignKey: "school_id" });
    };
  
    return School;
  };
  