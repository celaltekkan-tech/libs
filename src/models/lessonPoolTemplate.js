module.exports = (sequelize, DataTypes) => {
  const LessonPoolTemplate = sequelize.define(
    'LessonPoolTemplate',
    {
      name: DataTypes.STRING,
      school_type: DataTypes.STRING,
      levels: DataTypes.JSONB,
      items: DataTypes.JSONB,
      source_name: DataTypes.STRING,
      note: DataTypes.TEXT,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: DataTypes.INTEGER,
    },
    {
      tableName: 'LessonPoolTemplates',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return LessonPoolTemplate;
};
