module.exports = (sequelize, DataTypes) => {
  const District = sequelize.define(
    'District',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false,
      },
      province_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      slug: DataTypes.STRING(80),
    },
    {
      tableName: 'Districts',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  District.associate = (models) => {
    District.belongsTo(models.Province, { foreignKey: 'province_id' });
    District.hasMany(models.DirectorySchool, { foreignKey: 'district_id' });
  };

  return District;
};
