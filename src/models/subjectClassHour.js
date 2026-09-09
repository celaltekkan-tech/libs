module.exports = (sequelize, DataTypes) => {
  const SubjectClassHour = sequelize.define(
    'SubjectClassHour',
    {
      tenant_id: DataTypes.INTEGER,
      subject_id: DataTypes.INTEGER,
      class_level: DataTypes.STRING,
      weekly_hours: DataTypes.INTEGER,
    },
    {
      tableName: 'SubjectClassHours',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SubjectClassHour.associate = function (models) {
    SubjectClassHour.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    SubjectClassHour.belongsTo(models.Subject, { foreignKey: 'subject_id' });
  };

  return SubjectClassHour;
};
