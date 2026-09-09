module.exports = (sequelize, DataTypes) => {
  const TrainingRecord = sequelize.define(
    'TrainingRecord',
    {
      tenant_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      title: DataTypes.STRING,
      institution: DataTypes.STRING,
      start_date: DataTypes.DATEONLY,
      end_date: DataTypes.DATEONLY,
      hours: DataTypes.INTEGER,
      certificate_no: DataTypes.STRING,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'TrainingRecords',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TrainingRecord.associate = function (models) {
    TrainingRecord.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    TrainingRecord.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return TrainingRecord;
};
