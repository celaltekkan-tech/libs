module.exports = (sequelize, DataTypes) => {
  const SkillBusiness = sequelize.define(
    'SkillBusiness',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      tax_no: DataTypes.STRING,
      sgk_workplace_no: DataTypes.STRING,
      address: DataTypes.TEXT,
      phone: DataTypes.STRING,
      field_name: DataTypes.STRING,
      master_name: DataTypes.STRING,
      contact_name: DataTypes.STRING,
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'SkillBusinesses',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  SkillBusiness.associate = function (models) {
    SkillBusiness.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    SkillBusiness.belongsTo(models.School, { foreignKey: 'school_id' });
    SkillBusiness.hasMany(models.SkillPlacement, { foreignKey: 'business_id', as: 'Placements' });
  };

  return SkillBusiness;
};
