module.exports = (sequelize, DataTypes) => {
  const TimetableAvailability = sequelize.define(
    'TimetableAvailability',
    {
      tenant_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      entity_type: DataTypes.STRING,
      entity_id: DataTypes.INTEGER,
      cells: DataTypes.JSONB,
    },
    {
      tableName: 'TimetableAvailabilities',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableAvailability.associate = function (models) {
    TimetableAvailability.belongsTo(models.TimetableProject, { foreignKey: 'project_id' });
  };

  return TimetableAvailability;
};
