module.exports = (sequelize, DataTypes) => {
  const DisciplinaryCase = sequelize.define(
    'DisciplinaryCase',
    {
      tenant_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      incident_date: DataTypes.DATEONLY,
      description: DataTypes.TEXT,
      sanction_level: DataTypes.STRING,
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'acik',
      },
      decision_date: DataTypes.DATEONLY,
      decision_summary: DataTypes.TEXT,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'DisciplinaryCases',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplinaryCase.associate = function (models) {
    DisciplinaryCase.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DisciplinaryCase.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return DisciplinaryCase;
};
