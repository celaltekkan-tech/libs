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
        teacher_id: {
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
        last_seen_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        is_platform_admin: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        totp_secret: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        totp_enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        totp_backup_codes: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        phone: {
          type: DataTypes.STRING(30),
          allowNull: true,
        },
        sms_login_code_hash: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        sms_login_code_expires_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        sms_login_requests_date: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        sms_login_requests_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        login_failed_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        login_locked_until: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        tableName: "Users",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        defaultScope: {
          attributes: {
            exclude: [
              "password_hash",
              "totp_secret",
              "totp_backup_codes",
              "sms_login_code_hash",
            ],
          },
        },
        scopes: {
          withPassword: { attributes: { include: ["password_hash"] } },
          withTotp: {
            attributes: {
              include: ["password_hash", "totp_secret", "totp_backup_codes", "sms_login_code_hash"],
            },
          },
        },
      }
    );
  
    User.associate = (models) => {
      User.belongsTo(models.Tenant, { foreignKey: "tenant_id" });
      User.belongsTo(models.School, { foreignKey: "school_id" });
      User.belongsTo(models.Teacher, { foreignKey: "teacher_id" });
      User.hasMany(models.UserSchool, { foreignKey: "user_id" });
      User.hasMany(models.Feedback, { foreignKey: "user_id" });
    };
  
    return User;
  };
  