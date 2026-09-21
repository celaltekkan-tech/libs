module.exports = (sequelize, DataTypes) => {
  const Province = sequelize.define(
    'Province',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false,
      },
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      slug: DataTypes.STRING(80),
      region: DataTypes.STRING(60),
    },
    {
      tableName: 'Provinces',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Province.associate = (models) => {
    Province.hasMany(models.District, { foreignKey: 'province_id' });
    Province.hasMany(models.DirectorySchool, { foreignKey: 'province_id' });
  };

  return Province;
};
