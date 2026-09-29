module.exports = (sequelize, DataTypes) => {
  const SkillPlacement = sequelize.define(
    'SkillPlacement',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      business_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      academic_year: DataTypes.STRING,
      start_date: DataTypes.DATEONLY,
      end_date: DataTypes.DATEONLY,
      weekly_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
      contract_no: DataTypes.STRING,
      contract_date: DataTypes.DATEONLY,
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'aktif' },
      note: DataTypes.TEXT,
    },
    {
      tableName: 'SkillPlacements',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SkillPlacement.associate = function (models) {
    SkillPlacement.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    SkillPlacement.belongsTo(models.School, { foreignKey: 'school_id' });
    SkillPlacement.belongsTo(models.Student, { foreignKey: 'student_id' });
    SkillPlacement.belongsTo(models.SkillBusiness, { foreignKey: 'business_id', as: 'Business' });
    SkillPlacement.belongsTo(models.Teacher, { foreignKey: 'teacher_id', as: 'Coordinator' });
    SkillPlacement.hasMany(models.SkillSupportMonth, { foreignKey: 'placement_id', as: 'Supports' });
    SkillPlacement.hasMany(models.SkillSgkNotice, { foreignKey: 'placement_id', as: 'SgkNotices' });
  };

  return SkillPlacement;
};
