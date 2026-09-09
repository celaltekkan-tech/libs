module.exports = (sequelize, DataTypes) => {
  const ExamSession = sequelize.define(
    'ExamSession',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      exam_date: DataTypes.DATEONLY,
      notes: DataTypes.STRING,
    },
    {
      tableName: 'ExamSessions',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ExamSession.associate = function (models) {
    ExamSession.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ExamSession.belongsTo(models.School, { foreignKey: 'school_id' });
    ExamSession.hasMany(models.SeatAssignment, { foreignKey: 'exam_session_id' });
    ExamSession.hasMany(models.ProctorAssignment, { foreignKey: 'exam_session_id' });
  };

  return ExamSession;
};
