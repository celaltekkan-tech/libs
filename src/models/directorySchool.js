module.exports = (sequelize, DataTypes) => {
  const DirectorySchool = sequelize.define(
    'DirectorySchool',
    {
      province_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      district_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(250),
        allowNull: false,
      },
      school_type: {
        type: DataTypes.ENUM('ortaokul', 'lise'),
        allowNull: false,
      },
      website: DataTypes.STRING(300),
      code: DataTypes.STRING(6),
      logo_path: DataTypes.STRING(255),
      logo_checked_at: DataTypes.DATE,
    },
    {
      tableName: 'DirectorySchools',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DirectorySchool.associate = (models) => {
    DirectorySchool.belongsTo(models.Province, { foreignKey: 'province_id' });
    DirectorySchool.belongsTo(models.District, { foreignKey: 'district_id' });
  };

  return DirectorySchool;
};
