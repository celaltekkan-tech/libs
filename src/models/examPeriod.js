module.exports = (sequelize, DataTypes) => {
  const ExamPeriod = sequelize.define(
    'ExamPeriod',
    {
      tenant_id: DataTypes.INTEGER,
      academic_year_id: DataTypes.INTEGER,
      exam_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'ortak',
      },
      label: DataTypes.STRING,
      start_date: DataTypes.DATEONLY,
      end_date: DataTypes.DATEONLY,
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'ExamPeriods',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ExamPeriod.associate = function (models) {
    ExamPeriod.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ExamPeriod.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id' });
  };

  return ExamPeriod;
};
