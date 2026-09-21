module.exports = (sequelize, DataTypes) => {
  const DisciplineIncident = sequelize.define(
    'DisciplineIncident',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      incident_code: { type: DataTypes.STRING, allowNull: false },
      academic_year: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      incident_date: { type: DataTypes.DATEONLY, allowNull: false },
      incident_time: DataTypes.STRING,
      location: DataTypes.STRING,
      summary: DataTypes.TEXT,
      complainant_name: DataTypes.STRING,
      complaint_ref_date: DataTypes.DATEONLY,
      complaint_ref_no: DataTypes.STRING,
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'acik' },
      created_by: DataTypes.INTEGER,
    },
    {
      tableName: 'DisciplineIncidents',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineIncident.associate = function (models) {
    DisciplineIncident.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DisciplineIncident.belongsTo(models.School, { foreignKey: 'school_id' });
    DisciplineIncident.belongsTo(models.User, { foreignKey: 'created_by', as: 'CreatedBy' });
    DisciplineIncident.hasMany(models.DisciplineParticipant, { foreignKey: 'incident_id', as: 'Participants' });
    DisciplineIncident.hasMany(models.DisciplineStatement, { foreignKey: 'incident_id' });
    DisciplineIncident.hasMany(models.DisciplineInfoRequest, { foreignKey: 'incident_id' });
    DisciplineIncident.hasMany(models.DisciplineMeetingNotice, { foreignKey: 'incident_id' });
    DisciplineIncident.hasMany(models.DisciplineDecision, { foreignKey: 'incident_id' });
  };

  return DisciplineIncident;
};
