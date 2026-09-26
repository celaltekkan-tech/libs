module.exports = (sequelize, DataTypes) => {
  const TimetableConstraint = sequelize.define(
    'TimetableConstraint',
    {
      tenant_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      type: DataTypes.STRING,
      is_hard: DataTypes.BOOLEAN,
      weight: DataTypes.INTEGER,
      params: DataTypes.JSONB,
      source: DataTypes.STRING,
      source_text: DataTypes.TEXT,
      is_active: DataTypes.BOOLEAN,
    },
    {
      tableName: 'TimetableConstraints',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableConstraint.associate = function (models) {
    TimetableConstraint.belongsTo(models.TimetableProject, { foreignKey: 'project_id' });
  };

  return TimetableConstraint;
};
