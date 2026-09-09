module.exports = (sequelize, DataTypes) => {
  const ExtraLessonEntry = sequelize.define(
    'ExtraLessonEntry',
    {
      tenant_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      year: DataTypes.INTEGER,
      month: DataTypes.INTEGER,
      category: DataTypes.STRING,
      hours: DataTypes.DECIMAL(6, 2),
      notes: DataTypes.STRING,
    },
    {
      tableName: 'ExtraLessonEntries',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ExtraLessonEntry.associate = function (models) {
    ExtraLessonEntry.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ExtraLessonEntry.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return ExtraLessonEntry;
};
