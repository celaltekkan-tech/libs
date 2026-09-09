module.exports = (sequelize, DataTypes) => {
  const AcademicYear = sequelize.define(
    'AcademicYear',
    {
      tenant_id: DataTypes.INTEGER,
      label: DataTypes.STRING,
      start_date: DataTypes.DATEONLY,
      end_date: DataTypes.DATEONLY,
      is_current: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'AcademicYears',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  AcademicYear.associate = function (models) {
    AcademicYear.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
  };

  return AcademicYear;
};
